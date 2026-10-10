"""Beacon local API. No AWS SDK, provisioning, or paid inference is enabled."""

import hmac
import secrets
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from beacon import __version__
from beacon.models import RunRecord, SimulationInput
from beacon.repository import RunBusy, RunConflict, RunRepository
from beacon.security import ALLOWED_ORIGINS, BodyLimitMiddleware


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    product: Literal["Beacon"] = "Beacon"
    version: str = __version__
    stage: Literal["local-simulation"] = "local-simulation"
    aws_enabled: Literal[False] = False
    paid_inference_enabled: Literal[False] = False


def create_app() -> FastAPI:
    app = FastAPI(
        title="Beacon — AI cloud security lab", version=__version__,
        description="Local scripted simulations only. No AWS access or paid inference.",
        docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None,
    )
    app.state.session_token = secrets.token_urlsafe(32)
    app.state.runs = RunRepository()
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(
        CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS),
        allow_credentials=False, allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type", "X-Beacon-Token"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"], www_redirect=False)

    @app.middleware("http")
    async def local_request_boundary(request: Request, call_next):
        origin = request.headers.get("origin")
        protected_request = request.method in {"POST", "PUT", "PATCH", "DELETE"} or request.url.path == "/api/session"
        if protected_request and (
            (origin is not None and origin not in ALLOWED_ORIGINS)
            or request.headers.get("sec-fetch-site") == "cross-site"
        ):
            response = JSONResponse({"detail": "Only the trusted local interface may initiate simulations."}, status_code=403)
        elif request.method == "POST" and request.url.path == "/api/simulations" and request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
            response = JSONResponse({"detail": "Simulation requests must use application/json."}, status_code=415)
        else:
            response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    def require_session(request: Request):
        supplied = request.headers.get("x-beacon-token", "").encode("utf-8")
        expected = app.state.session_token.encode("utf-8")
        if not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=403, detail="Local session expired or missing. Refresh and try again.")

    @app.get("/api/health", response_model=HealthResponse)
    def health():
        return HealthResponse()

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
    def session():
        # Memory only. No cookies, browser persistence, or AWS credentials.
        return {"token": app.state.session_token}

    @app.post("/api/simulations", response_model=RunRecord, dependencies=[Depends(require_session)])
    def run_simulation(request: SimulationInput):
        try:
            return app.state.runs.execute(request)
        except RunConflict as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except RunBusy as error:
            raise HTTPException(status_code=429, detail=str(error), headers={"Retry-After": "60"}) from error

    return app


app = create_app()
