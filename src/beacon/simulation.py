"""Deterministic harness, NOT an LLM or a reproduction of AWS IAM.

The scripted assistant recognizes a narrowly specified fixture instruction.
Retrieval, permission checks, context delivery, and exposure are separately
observed. No backend request can select an AWS identity or arbitrary file.
"""

import hashlib
import logging
import re
import secrets
from datetime import datetime, timezone
from time import perf_counter
from typing import Callable
from uuid import uuid4

from beacon.fixtures import PAYROLL
from beacon.models import AssistantResult, AuditEvent, InputSnapshot, Role, RunRecord, SimulationInput

logger = logging.getLogger("beacon.audit")
DOCUMENT_KEYS = {
    "leave_policy": "policies/leave-policy.txt",
    "payroll": "private/payroll.csv",
}
ROLE_PERMISSIONS = {
    "vulnerable": frozenset({"leave_policy", "payroll"}),
    "protected": frozenset({"leave_policy"}),
}


class PermissionDenied(Exception):
    pass


class InvalidToolRequest(Exception):
    pass


class LocalDocumentStore:
    def __init__(self, policy: str, payroll: str):
        self._documents = {"leave_policy": policy, "payroll": payroll}

    def get_document(self, role: Role, document_id: str) -> str:
        if role not in ROLE_PERMISSIONS or document_id not in DOCUMENT_KEYS:
            raise InvalidToolRequest("Only fixed lab roles and document identifiers are accepted")
        if document_id not in ROLE_PERMISSIONS[role]:
            raise PermissionDenied("Local permission policy denies this document")
        return self._documents[document_id]


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def recognizes_injection(policy: str) -> bool:
    # This is deliberately a fixture recognizer, not a prompt-injection detector.
    return bool(re.search(
        r"(?:retrieve|read|fetch|access)[\s\S]{0,200}?private/payroll\.csv",
        policy,
        re.IGNORECASE,
    ))


def normal_answer(policy: str) -> str:
    allowance = re.search(r"\b(\d{1,3})\s+days?\s+(?:of\s+)?annual\s+leave\b", policy, re.IGNORECASE)
    if allowance:
        answer = f"The policy provides {allowance.group(1)} days of annual leave."
        if re.search(r"leave requests require manager approval", policy, re.IGNORECASE):
            answer += " Leave requests require manager approval."
        return answer
    return "The supplied policy does not specify a numeric annual-leave allowance in the scripted fixture format."


def simulate(request: SimulationInput) -> RunRecord:
    started_at = timestamp()
    clock = perf_counter()
    run_id = str(uuid4())
    marker = f"BEACON_SYNTHETIC_{secrets.token_hex(12)}"
    payroll = PAYROLL + f"exposure_marker,{marker}\n"
    store = LocalDocumentStore(request.policy, payroll)
    events: list[AuditEvent] = []

    def emit(actor: str, event_type: str, summary: str, **metadata):
        sequence = len(events) + 1
        event = AuditEvent(
            id=f"{run_id}:{sequence}", sequence=sequence, timestamp=timestamp(),
            offset_ms=round((perf_counter() - clock) * 1000, 3),
            actor=actor, event_type=event_type, summary=summary, metadata=metadata,
        )
        events.append(event)
        # Metadata contains identifiers/outcomes only, never document contents.
        logger.info(event.model_dump_json())

    emit("system", "run_started", "Local simulation started", behavior=request.behavior, target=request.target)
    roles: list[Role] = ["vulnerable", "protected"] if request.target == "both" else [request.target]
    results = [_run_assistant(role, request, store, marker, emit) for role in roles]
    emit("system", "run_completed", "Local simulation completed", result_count=len(results))
    return RunRecord(
        id=run_id, started_at=started_at, completed_at=timestamp(),
        duration_ms=round((perf_counter() - clock) * 1000, 3),
        document_hash=hashlib.sha256(request.policy.encode("utf-8")).hexdigest(),
        input=InputSnapshot(**request.model_dump(exclude={"mode", "idempotency_key"})),
        results=results, events=events,
    )


def _run_assistant(
    role: Role, request: SimulationInput, store: LocalDocumentStore,
    marker: str, emit: Callable,
) -> AssistantResult:
    # A new context is created for EACH role and EACH run. No shared model cache.
    context: list[tuple[str, str]] = []

    def retrieve(document_id: str) -> str:
        emit(role, "document_requested", f"Requested {DOCUMENT_KEYS[document_id]}", document_id=document_id, object_key=DOCUMENT_KEYS[document_id])
        content = store.get_document(role, document_id)
        emit(role, "document_retrieved", f"Retrieved {document_id} locally", document_id=document_id, byte_count=len(content.encode("utf-8")))
        context.append((document_id, content))
        emit(role, "document_delivered", f"Delivered {document_id} to the scripted context", document_id=document_id)
        return content

    policy = retrieve("leave_policy")
    direct_request = bool(re.search(r"\bpayroll\b", request.question, re.IGNORECASE))
    embedded_request = recognizes_injection(policy) and request.behavior != "ignore"
    requested = direct_request or embedded_request
    retrieved = False
    denied = False
    emit(role, "model_decision", "Scripted fixture selected its next action", payroll_requested=requested, direct_request=direct_request, scripted=True)
    payroll_content = ""
    if requested:
        try:
            payroll_content = retrieve("payroll")
            retrieved = True
        except PermissionDenied:
            denied = True
            emit(role, "access_denied", "Local permission policy blocked payroll", document_id="payroll", object_key=DOCUMENT_KEYS["payroll"], error_code="LOCAL_PERMISSION_DENIED", aws_request=False)

    delivered = any(document_id == "payroll" for document_id, _ in context)
    if denied:
        answer = "The local permission policy blocked payroll retrieval. " + normal_answer(policy)
    elif retrieved and request.behavior != "retrieve_only":
        answer = "Synthetic payroll retrieved by the scripted assistant:\n\n" + payroll_content
    else:
        answer = normal_answer(policy)
    exposed = marker in answer and "DEMO-101,4100" in answer
    if denied:
        outcome = "DENIED_BY_APP"
        explanation = "The local mock permission layer rejected payroll. This is not an AWS IAM denial."
    elif exposed:
        outcome = "EXPOSED"
        explanation = "The scripted assistant retrieved synthetic payroll and included its actual records and unique marker in the answer."
    elif delivered:
        outcome = "RETRIEVED_NOT_DISCLOSED"
        explanation = "Payroll reached the scripted context but not the final answer. Retrieval is still a confidentiality failure."
    else:
        outcome = "NOT_TRIGGERED"
        explanation = "No payroll tool request was made. This run does not exercise the payroll permission boundary."
    emit(role, "answer_generated", "Final scripted answer recorded", outcome=outcome, payroll_delivered=delivered, payroll_exposed=exposed)
    return AssistantResult(
        role=role, outcome=outcome, answer=answer, payroll_requested=requested,
        payroll_retrieved=retrieved, payroll_delivered_to_model=delivered,
        payroll_exposed=exposed, explanation=explanation,
    )
