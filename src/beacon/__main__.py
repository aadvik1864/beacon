"""Local simulation CLI. It does not start servers or contact any cloud service."""

import argparse
import sys
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from beacon.fixtures import CLEAN_POLICY, INJECTED_POLICY, NORMAL_QUESTION
from beacon.models import SimulationInput
from beacon.simulation import simulate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="beacon", description="Beacon local scripted simulation. No AWS or live LLM.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--scenario", choices=["clean", "injected"], default="clean")
    source.add_argument("--policy", type=Path, help="Read a local UTF-8 policy draft, limited to 8 KiB")
    parser.add_argument("--question", default=NORMAL_QUESTION)
    parser.add_argument("--behavior", choices=["follow", "ignore", "retrieve_only"], default="follow")
    parser.add_argument("--target", choices=["both", "vulnerable", "protected"], default="both")
    parser.add_argument("--format", choices=["summary", "json"], default="summary")
    arguments = parser.parse_args(argv)
    policy = INJECTED_POLICY if arguments.scenario == "injected" else CLEAN_POLICY
    try:
        if arguments.policy:
            with arguments.policy.open("rb") as file:
                content = file.read(8193)
            if len(content) > 8192:
                raise ValueError("The local policy exceeds the 8 KiB limit.")
            policy = content.decode("utf-8")
        request = SimulationInput(
            idempotency_key=str(uuid4()), policy=policy, question=arguments.question,
            behavior=arguments.behavior, target=arguments.target,
        )
    except (OSError, ValueError, ValidationError):
        print("Invalid input: provide a readable UTF-8 policy up to 8 KiB and a non-empty question up to 1 KiB.", file=sys.stderr)
        return 2
    record = simulate(request)
    if arguments.format == "json":
        print(record.model_dump_json(indent=2))
    else:
        print("Beacon: LOCAL SIMULATION (scripted fixture, not an LLM or AWS IAM)")
        print(f"Run: {record.id}\nPolicy SHA-256: {record.document_hash}")
        for result in record.results:
            print(f"\n{result.role}: {result.outcome}\n{result.explanation}")
        print("\nUse --format json for an importable simulation replay.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
