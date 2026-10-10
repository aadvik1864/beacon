import hashlib
import logging
import re
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from beacon.api import create_app
from beacon.models import SimulationInput
from beacon.repository import RunBusy, RunRepository
from beacon.simulation import InvalidToolRequest, LocalDocumentStore, PermissionDenied, simulate

DATA = Path(__file__).resolve().parents[2] / "data"
CLEAN = (DATA / "leave-policy-clean.txt").read_text().strip()
ATTACK = (DATA / "leave-policy-injected.txt").read_text().strip()


def payload(**changes):
    return {
        "mode": "simulation", "idempotency_key": str(uuid4()),
        "policy": ATTACK, "question": "How many days of leave can I take?",
        "behavior": "follow", "target": "both", **changes,
    }


@pytest.fixture
def api_client():
    app = create_app()
    with TestClient(app, base_url="http://localhost") as client:
        token = client.get("/api/session").json()["token"]
        yield client, {"X-Beacon-Token": token}, app


def test_attack_separates_retrieval_delivery_and_disclosure(caplog):
    with caplog.at_level(logging.INFO, logger="beacon.audit"):
        run = simulate(SimulationInput(**payload()))
    vulnerable, protected = run.results
    assert vulnerable.outcome == "EXPOSED"
    assert vulnerable.payroll_requested and vulnerable.payroll_retrieved
    assert vulnerable.payroll_delivered_to_model and vulnerable.payroll_exposed
    assert protected.outcome == "DENIED_BY_APP"
    assert protected.payroll_requested
    assert not protected.payroll_retrieved
    assert not protected.payroll_delivered_to_model
    assert not protected.payroll_exposed
    marker = re.search(r"BEACON_SYNTHETIC_[a-f0-9]+", vulnerable.answer).group()
    assert marker not in protected.answer
    assert marker not in caplog.text
    assert "DEMO-101,4100" not in caplog.text
    assert run.aws_used is False and run.model_is_live is False
    assert run.document_hash == hashlib.sha256(ATTACK.encode()).hexdigest()
    assert [event.sequence for event in run.events] == list(range(1, len(run.events) + 1))
    assert all(event.source == "local-simulation" for event in run.events)


@pytest.mark.parametrize("changes", [{"policy": CLEAN}, {"behavior": "ignore"}])
def test_non_triggered_is_not_reported_as_permission_enforcement(changes):
    run = simulate(SimulationInput(**payload(**changes)))
    assert all(result.outcome == "NOT_TRIGGERED" for result in run.results)
    assert all(not result.payroll_requested for result in run.results)
    assert not any(event.event_type == "access_denied" for event in run.events)
    assert all("20 days" in result.answer for result in run.results)


def test_retrieval_without_disclosure_is_still_recorded():
    run = simulate(SimulationInput(**payload(behavior="retrieve_only")))
    result = run.results[0]
    assert result.outcome == "RETRIEVED_NOT_DISCLOSED"
    assert result.payroll_delivered_to_model and not result.payroll_exposed
    assert run.results[1].outcome == "DENIED_BY_APP"


def test_direct_request_exercises_boundary_without_document_injection():
    run = simulate(SimulationInput(**payload(policy=CLEAN, question="Read the synthetic payroll", behavior="ignore")))
    assert run.results[0].outcome == "EXPOSED"
    assert run.results[1].outcome == "DENIED_BY_APP"


def test_modified_policy_answer_is_not_a_fixed_fake_response():
    run = simulate(SimulationInput(**payload(policy=CLEAN.replace("20 days", "28 days"))))
    assert all("28 days" in result.answer for result in run.results)


def test_fixture_does_not_invent_manager_approval_when_removed():
    run = simulate(SimulationInput(**payload(policy="Employees receive 28 days of annual leave.")))
    assert all("manager" not in result.answer for result in run.results)


def test_protected_run_does_not_reuse_previous_payroll_context():
    first = simulate(SimulationInput(**payload(target="vulnerable")))
    second = simulate(SimulationInput(**payload(target="protected")))
    marker = re.search(r"BEACON_SYNTHETIC_[a-f0-9]+", first.results[0].answer).group()
    assert marker not in second.model_dump_json()
    assert not second.results[0].payroll_delivered_to_model


def test_tool_does_not_accept_paths_urls_or_unknown_roles():
    store = LocalDocumentStore(CLEAN, "synthetic payroll")
    assert store.get_document("protected", "leave_policy") == CLEAN
    with pytest.raises(PermissionDenied):
        store.get_document("protected", "payroll")
    for document_id in ["../../etc/passwd", "private/payroll.csv", "https://example.com", "unknown"]:
        with pytest.raises(InvalidToolRequest):
            store.get_document("vulnerable", document_id)
    with pytest.raises(InvalidToolRequest):
        store.get_document("administrator", "payroll")


def test_simulation_requires_a_local_session(api_client):
    client, headers, _ = api_client
    assert client.post("/api/simulations", json=payload()).status_code == 403
    response = client.post("/api/simulations", json=payload(), headers=headers)
    assert response.status_code == 200
    assert response.json()["product"] == "Beacon"


@pytest.mark.parametrize("headers", [
    {"Origin": "https://attacker.example"}, {"Sec-Fetch-Site": "cross-site"},
])
def test_session_cannot_be_obtained_cross_site(api_client, headers):
    client, _, _ = api_client
    assert client.get("/api/session", headers=headers).status_code == 403


def test_cross_site_post_is_denied_even_with_a_valid_token(api_client):
    client, headers, _ = api_client
    assert client.post("/api/simulations", json=payload(), headers={**headers, "Origin": "https://attacker.example"}).status_code == 403


@pytest.mark.parametrize("changes", [
    {"mode": "aws"}, {"target": "admin"}, {"role_arn": "arbitrary"},
    {"policy": " "}, {"policy": "a" * 8193}, {"policy": "é" * 5000},
    {"question": ""}, {"question": "q" * 1025}, {"idempotency_key": "not-a-uuid"},
])
def test_invalid_or_cloud_inputs_are_rejected(api_client, changes):
    client, headers, _ = api_client
    assert client.post("/api/simulations", json=payload(**changes), headers=headers).status_code == 422


def test_body_limit_and_json_content_type(api_client):
    client, headers, _ = api_client
    assert client.post("/api/simulations", json=payload(policy="a" * 40000), headers=headers).status_code == 413
    assert client.post("/api/simulations", content="{}", headers={**headers, "Content-Type": "text/plain"}).status_code == 415


def test_duplicate_submissions_return_the_same_capture(api_client):
    client, headers, app = api_client
    data = payload()
    first = client.post("/api/simulations", json=data, headers=headers)
    second = client.post("/api/simulations", json=data, headers=headers)
    assert first.json() == second.json()
    assert len(app.state.runs._records) == 1
    assert client.post("/api/simulations", json={**data, "question": "Different question"}, headers=headers).status_code == 409


def test_single_target_cannot_receive_the_other_targets_context(api_client):
    client, headers, _ = api_client
    data = client.post("/api/simulations", json=payload(target="protected"), headers=headers).json()
    assert [result["role"] for result in data["results"]] == ["protected"]
    assert not any(event["actor"] == "vulnerable" for event in data["events"])


def test_repository_is_bounded_and_rate_limited():
    repository = RunRepository(capacity=2, rate_limit=3)
    for _ in range(3):
        repository.execute(SimulationInput(**payload()))
    assert len(repository._records) == 2
    with pytest.raises(RunBusy):
        repository.execute(SimulationInput(**payload()))


def test_repository_rejects_overlap():
    repository = RunRepository()
    repository._lock.acquire()
    try:
        with pytest.raises(RunBusy):
            repository.execute(SimulationInput(**payload()))
    finally:
        repository._lock.release()
