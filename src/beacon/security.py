"""Gateway authentication, user-bound CSRF, bounded requests, and safe telemetry."""

import asyncio
import hashlib
import hmac
import logging
import re
import secrets
import threading
import time
from collections import defaultdict, deque

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

from beacon.config import LOCAL_ORIGINS, Settings

ALLOWED_ORIGINS = LOCAL_ORIGINS
MAX_REQUEST_BYTES = 32768
logger = logging.getLogger("beacon.security")


def configure_security_logging():
    if not any(handler.name == 'beacon-safe-metadata' for handler in logger.handlers):
        handler = logging.StreamHandler()
        handler.name = 'beacon-safe-metadata'
        handler.setFormatter(logging.Formatter('%(levelname)s %(message)s'))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)


SAFE_HEADERS = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}


class SessionTokens:
    def __init__(self, secret: str, ttl: int = 900):
        self.secret = secret.encode()
        self.ttl = ttl

    def _signature(self, principal: str, payload: str) -> str:
        return hmac.new(self.secret, f"{principal}\n{payload}".encode(), hashlib.sha256).hexdigest()

    def issue(self, principal: str) -> str:
        payload = f"{int(time.time()) + self.ttl}.{secrets.token_hex(16)}"
        return f"{payload}.{self._signature(principal, payload)}"

    def valid(self, principal: str, token: str) -> bool:
        if not re.fullmatch(r"[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}", token):
            return False
        expiry, nonce, signature = token.split(".")
        now = int(time.time())
        return now < int(expiry) <= now + self.ttl and hmac.compare_digest(signature, self._signature(principal, f"{expiry}.{nonce}"))


class RequestLimiter:
    """Single-process limiter; production deliberately runs exactly one worker."""
    def __init__(self, per_user: int = 120, total: int = 600):
        self.per_user = per_user
        self.total = total
        self.users: dict[str, deque] = defaultdict(deque)
        self.all: deque = deque()
        self.lock = threading.Lock()

    def allow(self, principal: str) -> bool:
        with self.lock:
            now = time.monotonic()
            for key in list(self.users):
                timestamps = self.users[key]
                while timestamps and now - timestamps[0] >= 60:
                    timestamps.popleft()
                if not timestamps:
                    del self.users[key]
            while self.all and now - self.all[0] >= 60:
                self.all.popleft()
            timestamps = self.users[principal]
            if len(timestamps) >= self.per_user or len(self.all) >= self.total:
                return False
            timestamps.append(now)
            self.all.append(now)
            return True


class SecurityBoundaryMiddleware:
    def __init__(self, app, settings: Settings):
        self.app = app
        self.settings = settings
        self.limiter = RequestLimiter()
        self.tokens = SessionTokens(settings.csrf_secret)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = secrets.token_hex(12)
        scope.setdefault("state", {})["request_id"] = request_id
        status = 500
        started = False

        async def secure_send(message):
            nonlocal status, started
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                headers = MutableHeaders(scope=message)
                for key, value in SAFE_HEADERS.items():
                    headers[key] = value
                headers["X-Request-ID"] = request_id
                if self.settings.production:
                    headers["Strict-Transport-Security"] = "max-age=31536000"
            await send(message)

        async def deny(code, detail, extra=None):
            await JSONResponse({"detail": detail}, status_code=code, headers=extra)(scope, receive, secure_send)

        try:
            headers = Headers(scope=scope)
            if sum(len(key) + len(value) for key, value in scope["headers"]) > 16384:
                return await deny(431, "Request headers are too large.")
            for key in ("host", "origin", "x-beacon-gateway", "x-beacon-identity", "x-beacon-token", "content-length", "content-type"):
                if len(headers.getlist(key)) > 1:
                    return await deny(400, "Duplicate security-sensitive header.")
            # Internal probe has no version, identity, configuration, or lab data.
            if scope["path"] == "/healthz" and scope["method"] == "GET":
                return await JSONResponse({"status": "ok"})(scope, receive, secure_send)
            if self.settings.production:
                gateway = headers.get("x-beacon-gateway", "").encode()
                if not hmac.compare_digest(gateway, self.settings.gateway_secret.encode()):
                    return await deny(401, "Authentication required.")
                identity = headers.get("x-beacon-identity", "")
                if identity not in self.settings.allowed_emails:
                    return await deny(403, "Access denied.")
                # Opaque identity key, never the email, in cache/rate-limit state.
                principal = hmac.new(self.settings.csrf_secret.encode(), identity.encode(), hashlib.sha256).hexdigest()
                if not self.limiter.allow(principal):
                    return await deny(429, "Request limit reached. Try again later.", {"Retry-After": "60"})
            else:
                principal = "local"
            scope["state"]["principal"] = principal
            origin = headers.get("origin")
            protected = self.settings.production or scope["method"] in {"POST", "PUT", "PATCH", "DELETE"} or scope["path"] == "/api/session"
            if protected and ((origin is not None and origin not in self.settings.origins) or headers.get("sec-fetch-site") == "cross-site"):
                return await deny(403, "Untrusted request origin.")
            if self.settings.production and scope["method"] in {"POST", "PUT", "PATCH", "DELETE"} and origin not in self.settings.origins:
                return await deny(403, "A same-origin request is required.")
            if scope["method"] == "POST" and scope["path"] in {"/api/simulations", "/api/captures/clear"} and not self.tokens.valid(principal, headers.get("x-beacon-token", "")):
                return await deny(403, "Request session expired or missing. Refresh and try again.")
            if scope["method"] == "POST" and scope["path"] == "/api/simulations" and headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                return await deny(415, "Simulation requests must use application/json.")
            await self.app(scope, receive, secure_send)
        except Exception:
            # Never log exception repr, headers, URLs/queries, identity, or inputs.
            logger.error("request_failed request_id=%s", request_id)
            if started:
                raise
            await deny(500, "Request could not be completed.")
        finally:
            if self.settings.production:
                logger.info("request_complete request_id=%s status=%d", request_id, status)


class BodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        size = headers.get("content-length")
        if size is not None and (not size.isascii() or not size.isdigit()):
            return await JSONResponse({"detail": "Invalid content length."}, status_code=400)(scope, receive, send)
        if size is not None and (len(size) > 8 or int(size) > MAX_REQUEST_BYTES):
            return await JSONResponse({"detail": "Request exceeds the 32 KiB limit."}, status_code=413)(scope, receive, send)
        body = bytearray()
        try:
            # Also bounds slow streaming bodies; gateway enforces its own timeout.
            async with asyncio.timeout(10):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > MAX_REQUEST_BYTES:
                        return await JSONResponse({"detail": "Request exceeds the 32 KiB limit."}, status_code=413)(scope, receive, send)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await JSONResponse({"detail": "Request body timed out."}, status_code=408)(scope, receive, send)
        delivered = False

        async def replay_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)
