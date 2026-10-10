"""Bounded input and evidence schemas. Only local simulations are accepted."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["vulnerable", "protected"]
Behavior = Literal["follow", "ignore", "retrieve_only"]
Outcome = Literal[
    "NOT_TRIGGERED", "DENIED_BY_APP", "RETRIEVED_NOT_DISCLOSED", "EXPOSED", "ERROR"
]
EventType = Literal[
    "run_started", "document_requested", "document_retrieved", "access_denied",
    "document_delivered", "model_decision", "answer_generated", "run_completed",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SimulationInput(StrictModel):
    mode: Literal["simulation"] = "simulation"
    idempotency_key: str
    policy: str = Field(min_length=1, max_length=8192)
    question: str = Field(min_length=1, max_length=1024)
    behavior: Behavior = "follow"
    target: Literal["both", "vulnerable", "protected"] = "both"

    @field_validator("idempotency_key")
    @classmethod
    def valid_key(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("policy", "question")
    @classmethod
    def bounded_text(cls, value: str, info) -> str:
        if not value.strip():
            raise ValueError("Text cannot be blank")
        limit = 8192 if info.field_name == "policy" else 1024
        if len(value.encode("utf-8")) > limit:
            raise ValueError(f"Text exceeds the {limit}-byte limit")
        return value


class InputSnapshot(StrictModel):
    policy: str
    question: str
    behavior: Behavior
    target: Literal["both", "vulnerable", "protected"]


class AuditEvent(StrictModel):
    id: str
    sequence: int
    timestamp: str
    offset_ms: float
    actor: Literal["system", "vulnerable", "protected"]
    event_type: EventType
    summary: str
    source: Literal["local-simulation"] = "local-simulation"
    metadata: dict[str, str | int | bool]


class AssistantResult(StrictModel):
    role: Role
    outcome: Outcome
    answer: str
    payroll_requested: bool
    payroll_retrieved: bool
    payroll_delivered_to_model: bool
    payroll_exposed: bool
    explanation: str


class RunRecord(StrictModel):
    schema_version: Literal[1] = 1
    id: str
    mode: Literal["simulation"] = "simulation"
    product: Literal["Beacon"] = "Beacon"
    started_at: str
    completed_at: str
    duration_ms: float
    document_hash: str
    model_id: Literal["scripted-fixture-v1"] = "scripted-fixture-v1"
    model_is_live: Literal[False] = False
    aws_used: Literal[False] = False
    input: InputSnapshot
    results: list[AssistantResult]
    events: list[AuditEvent]
