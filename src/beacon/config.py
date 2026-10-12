"""Fail-closed deployment configuration. Secret values never appear in errors/repr."""

import os
import re
import secrets
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

EMAIL = re.compile(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}")
SECRET = re.compile(r"[A-Za-z0-9_-]{43,128}")
LOCAL_ORIGINS = frozenset({"http://localhost:5173", "http://127.0.0.1:5173"})


class ConfigurationError(ValueError):
    pass


def read_private_file(variable: str) -> str:
    path = os.environ.get(variable, "")
    try:
        source = Path(path)
        if not path or not source.is_file() or source.stat().st_size > 16384:
            raise ValueError
        return source.read_text(encoding="utf-8").strip()
    except (OSError, ValueError):
        raise ConfigurationError(f"{variable} must point to a readable, bounded configuration file.") from None


@dataclass(frozen=True)
class Settings:
    production: bool = False
    origins: frozenset[str] = LOCAL_ORIGINS
    hosts: tuple[str, ...] = ("localhost", "127.0.0.1")
    gateway_secret: str = field(default="", repr=False)
    csrf_secret: str = field(default_factory=lambda: secrets.token_urlsafe(48), repr=False)
    allowed_emails: frozenset[str] = field(default_factory=frozenset, repr=False)

    def __post_init__(self):
        if not self.production:
            if self.origins != LOCAL_ORIGINS or self.hosts != ("localhost", "127.0.0.1"):
                raise ConfigurationError("Development mode only supports loopback hosts/origins.")
            return
        if len(self.origins) != 1:
            raise ConfigurationError("Production requires one canonical HTTPS origin.")
        origin = next(iter(self.origins))
        parsed = urlsplit(origin)
        if (
            parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment
            or not re.fullmatch(r"https://[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[0-9]{1,5})?", origin)
            or self.hosts != (parsed.hostname,)
        ):
            raise ConfigurationError("Production requires one canonical HTTPS origin and matching host.")
        try:
            if parsed.port == 0:
                raise ValueError
        except ValueError:
            raise ConfigurationError("Invalid production HTTPS port.") from None
        if not SECRET.fullmatch(self.gateway_secret) or not SECRET.fullmatch(self.csrf_secret):
            raise ConfigurationError("Production gateway and CSRF keys must each contain at least 32 random bytes.")
        if secrets.compare_digest(self.gateway_secret, self.csrf_secret):
            raise ConfigurationError("Gateway and CSRF keys must be different.")
        if not 1 <= len(self.allowed_emails) <= 100 or any(not EMAIL.fullmatch(email) or '*' in email for email in self.allowed_emails):
            raise ConfigurationError("Production requires 1 to 100 explicit lowercase allowed email addresses.")

    @classmethod
    def from_env(cls):
        mode = os.environ.get("BEACON_ENV", "development")
        if mode not in {"development", "production"}:
            raise ConfigurationError("BEACON_ENV must be development or production.")
        if mode == "development":
            # Never silently downgrade a partially configured deployment.
            if any(key in os.environ for key in (
                "BEACON_PUBLIC_ORIGIN", "BEACON_GATEWAY_SECRET_FILE", "BEACON_CSRF_SECRET_FILE", "BEACON_ALLOWED_EMAILS_FILE",
            )):
                raise ConfigurationError("Deployment configuration requires BEACON_ENV=production.")
            return cls()
        origin = os.environ.get("BEACON_PUBLIC_ORIGIN", "")
        return cls(
            production=True, origins=frozenset({origin}), hosts=(urlsplit(origin).hostname or "",),
            gateway_secret=read_private_file("BEACON_GATEWAY_SECRET_FILE"),
            csrf_secret=read_private_file("BEACON_CSRF_SECRET_FILE"),
            allowed_emails=frozenset(read_private_file("BEACON_ALLOWED_EMAILS_FILE").splitlines()),
        )
