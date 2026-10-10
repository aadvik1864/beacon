import json
from pathlib import Path

from beacon.__main__ import main
from beacon.fixtures import CLEAN_POLICY, INJECTED_POLICY, PAYROLL


def test_cli_summary_is_explicitly_local(capsys):
    assert main(["--scenario", "injected"]) == 0
    output = capsys.readouterr().out
    assert "LOCAL SIMULATION" in output
    assert "vulnerable: EXPOSED" in output
    assert "protected: DENIED_BY_APP" in output


def test_cli_json_is_an_importable_replay(capsys):
    assert main(["--scenario", "clean", "--target", "protected", "--format", "json"]) == 0
    record = json.loads(capsys.readouterr().out)
    assert record["aws_used"] is False
    assert record["model_is_live"] is False
    assert record["results"][0]["outcome"] == "NOT_TRIGGERED"


def test_cli_rejects_oversized_local_input(tmp_path, capsys):
    policy = tmp_path / "policy.txt"
    policy.write_text("a" * 8193)
    assert main(["--policy", str(policy)]) == 2
    assert "Invalid input" in capsys.readouterr().err


def test_python_defaults_match_documented_fixtures():
    data = Path(__file__).resolve().parents[2] / "data"
    assert (data / "leave-policy-clean.txt").read_text().strip() == CLEAN_POLICY
    assert (data / "leave-policy-injected.txt").read_text().strip() == INJECTED_POLICY
    assert (data / "payroll.csv").read_text() == PAYROLL
