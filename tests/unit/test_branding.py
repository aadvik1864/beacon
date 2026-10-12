import json
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_package_manifests_share_beacon_name():
    python = tomllib.loads((ROOT / "pyproject.toml").read_text())
    frontend = json.loads((ROOT / "frontend/package.json").read_text())
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text())
    assert python["project"]["name"] == "beacon"
    assert frontend["name"] == "beacon"
    assert lock["name"] == "beacon"
    assert lock["packages"][""]["name"] == "beacon"


def test_browser_title_uses_beacon_name():
    assert "<title>Beacon | An interactive AI safety lab</title>" in (ROOT / "frontend/index.html").read_text()
