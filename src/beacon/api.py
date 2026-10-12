"""Beacon local API. No AWS SDK, provisioning, or paid inference is enabled."""

import asyncio
from contextlib import asynccontextmanager, suppress
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from beacon import __version__
from beacon.config import Settings
from beacon.models import RunRecord, SimulationInput
from beacon.repository import RunBusy, RunConflict, RunRepository
from beacon.security import BodyLimitMiddleware, SecurityBoundaryMiddleware, SessionTokens, configure_security_logging


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    product: Literal["Beacon"] = "Beacon"
    version: str = __version__
    stage: Literal["local-simulation"] = "local-simulation"
    aws_enabled: Literal[False] = False
    paid_inference_enabled: Literal[False] = False
    access_mode: Literal["local", "sso"] = "local"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    if settings.production:
        configure_security_logging()

    @asynccontextmanager
    async def lifespan(app):
        async def expire_captures():
            while True:
                await asyncio.sleep(30)
                app.state.runs.purge_expired()
        cleanup = asyncio.create_task(expire_captures())
        try:
            yield
        finally:
            cleanup.cancel()
            with suppress(asyncio.CancelledError):
                await cleanup

    app = FastAPI(
        title="Beacon", version=__version__,
        description="Local scripted simulations only. No AWS access or paid inference.",
        docs_url=None if settings.production else "/api/docs",
        openapi_url=None if settings.production else "/api/openapi.json", redoc_url=None, lifespan=lifespan,
    )
    app.state.tokens = SessionTokens(settings.csrf_secret)
    app.state.runs = RunRepository(ttl=300 if settings.production else 1800)
    app.state.settings = settings
    app.add_middleware(BodyLimitMiddleware)
    if not settings.production:
        app.add_middleware(
            CORSMiddleware, allow_origins=sorted(settings.origins),
            allow_credentials=False, allow_methods=["GET", "POST"],
            allow_headers=["Accept", "Content-Type", "X-Beacon-Token"],
        )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.hosts), www_redirect=False)
    app.add_middleware(SecurityBoundaryMiddleware, settings=settings)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # FastAPI's default error includes rejected raw inputs and validator context.
        return JSONResponse({"detail": "Invalid request. Check input limits and use synthetic data without credentials."}, status_code=422)

    def require_session(request: Request):
        if not app.state.tokens.valid(request.state.principal, request.headers.get("x-beacon-token", "")):
            raise HTTPException(status_code=403, detail="Request session expired or missing. Refresh and try again.")

    @app.get("/api/health", response_model=HealthResponse)
    def health():
        return HealthResponse(access_mode="sso" if settings.production else "local")

    @app.get("/api/capabilities")
    def capabilities():
        return {
            "product": "Beacon", "mode": "simulation", "can_run_experiments": True,
            "can_run_aws_experiments": False, "can_modify_cloud_resources": False,
            "targets": [
                {"id": "vulnerable", "label": "Vulnerable lab role", "allowed_documents": ["leave_policy", "payroll"], "provisioned": False},
                {"id": "protected", "label": "Protected lab role", "allowed_documents": ["leave_policy"], "provisioned": False},
            ],
        }

    @app.get("/api/session")
    def session(request: Request):
        # Browser only receives a short-lived CSRF token, never gateway/SSO secrets.
        return {"token": app.state.tokens.issue(request.state.principal)}

    @app.post("/api/simulations", response_model=RunRecord, dependencies=[Depends(require_session)])
    def run_simulation(request: SimulationInput, http_request: Request):
        try:
            return app.state.runs.execute(request, principal=http_request.state.principal)
        except RunConflict as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except RunBusy as error:
            raise HTTPException(status_code=429, detail=str(error), headers={"Retry-After": "60"}) from error

    @app.post("/api/captures/clear", dependencies=[Depends(require_session)])
    def clear_captures(request: Request):
        app.state.runs.clear(request.state.principal)
        return {"cleared": True}

    return app


app = create_app()
