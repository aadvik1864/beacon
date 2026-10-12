from pathlib import Path
import base64
import importlib.util
import json
import os
import secrets
import stat
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def test_secret_generator_is_private_and_does_not_overwrite(tmp_path):
    directory = tmp_path / 'private-config'
    command = [sys.executable, str(ROOT / 'scripts/init-secrets.py'), str(directory)]
    first = subprocess.run(command, capture_output=True, text=True)
    assert first.returncode == 0
    assert len(list(directory.iterdir())) == 5
    original = {}
    for path in directory.iterdir():
        original[path.name] = path.read_text()
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert path.read_text().strip() not in first.stdout + first.stderr
    second = subprocess.run(command, capture_output=True, text=True)
    assert second.returncode != 0
    assert {path.name: path.read_text() for path in directory.iterdir()} == original


def test_secret_generator_refuses_repository_paths():
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/init-secrets.py'), str(ROOT / 'secrets')], capture_output=True, text=True)
    assert result.returncode != 0
    assert 'outside' in result.stderr


def test_preflight_missing_configuration_fails_without_traceback(tmp_path):
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/check-deployment.py'), '--env-file', str(tmp_path / 'missing')], capture_output=True, text=True)
    assert result.returncode == 1
    assert 'preflight failed' in result.stderr
    assert 'Traceback' not in result.stderr


def test_valid_preflight_and_insecure_permissions_are_checked(monkeypatch, tmp_path, capsys):
    spec = importlib.util.spec_from_file_location('beacon_deployment_check', ROOT / 'scripts/check-deployment.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    redis = secrets.token_urlsafe(48)
    values = {
        'gateway_key': secrets.token_urlsafe(48), 'csrf_key': secrets.token_urlsafe(48),
        'cookie_key': base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
        'allowed_emails': 'alice@example.com', 'oidc_client_secret': secrets.token_urlsafe(48),
        'redis_config': 'requirepass ' + redis, 'sso_store_config': f'redis_password = "{redis}"',
    }
    definitions = {}
    for name, value in values.items():
        path = tmp_path / name
        path.write_text(value)
        path.chmod(0o600)
        definitions[name] = {'file': str(path)}
    hardened = {'user': '10001:10001', 'read_only': True, 'cap_drop': ['ALL']}
    config = {
        'secrets': definitions,
        'services': {
            'api': {**hardened, 'environment': {'BEACON_PUBLIC_ORIGIN': 'https://beacon.company.test'}},
            'sso': {**hardened, 'command': ['--oidc-issuer-url=https://identity.company.test']},
            'gateway': hardened, 'sessions': hardened,
        },
        'networks': {'backend': {'internal': True}, 'sessions': {'internal': True}},
    }
    monkeypatch.setattr(module.subprocess, 'run', lambda *a, **k: subprocess.CompletedProcess([], 0, stdout=json.dumps(config)))
    real_stat = Path.stat
    def fake_owner(path, *a, **k):
        original = real_stat(path, *a, **k)
        if path.parent == tmp_path:
            fields = list(original)
            fields[4] = 10001
            return os.stat_result(fields)
        return original
    monkeypatch.setattr(Path, 'stat', fake_owner)
    monkeypatch.setattr(sys, 'argv', ['check-deployment.py'])
    assert module.main() == 0
    (tmp_path / 'gateway_key').chmod(0o644)
    assert module.main() == 1
    output = capsys.readouterr()
    for value in values.values():
        assert value not in output.out + output.err
