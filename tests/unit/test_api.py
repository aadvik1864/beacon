import pytest
from fastapi.testclient import TestClient

from beacon.api import create_app


@pytest.fixture
def client():
    with TestClient(create_app(), base_url="http://localhost") as client:
        yield client


def test_health_does_not_enable_cloud_services(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "product": "Beacon",
        "version": "0.2.0",
        "stage": "local-simulation",
        "aws_enabled": False,
        "paid_inference_enabled": False,
    }
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_targets_are_fixed_and_not_provisioned(client):
    data = client.get("/api/capabilities").json()
    assert data["mode"] == "simulation"
    assert data["can_run_experiments"] is True
    assert data["can_run_aws_experiments"] is False
    assert data["can_modify_cloud_resources"] is False
    assert [target["id"] for target in data["targets"]] == ["vulnerable", "protected"]
    assert all(target["provisioned"] is False for target in data["targets"])
    assert data["targets"][1]["allowed_documents"] == ["leave_policy"]


def test_cors_allows_only_expected_frontend_origin(client):
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_cors_allows_local_post_with_explicit_session_header(client):
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-Beacon-Token,Content-Type",
        },
    )
    assert response.status_code == 200


def test_untrusted_host_is_rejected(client):
    assert client.get("/api/health", headers={"Host": "untrusted.example"}).status_code == 400


@pytest.mark.parametrize("path", ["/api/run", "/api/deploy", "/api/upload"])
def test_execution_and_mutation_endpoints_do_not_exist(client, path):
    assert client.post(path, json={"role_arn": "arbitrary", "mode": "vulnerable"}).status_code == 404


def test_health_is_read_only(client):
    assert client.post("/api/health").status_code == 405
