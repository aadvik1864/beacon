import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
COMMIT = 'a' * 40
REPOSITORY = 'aadvik1864/beacon'


@pytest.fixture
def release():
    spec = importlib.util.spec_from_file_location('beacon_release_check', ROOT / 'scripts/check-release.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ci_fixture(release, monkeypatch, *, private=True, status='completed', conclusion='success', sha=COMMIT, missing=None, older_green=False):
    run = {'databaseId': 42, 'headSha': sha, 'status': status, 'conclusion': conclusion, 'event': 'push', 'url': f'https://github.com/{REPOSITORY}/actions/runs/42'}
    runs = [run]
    if older_green:
        runs.append({**run, 'databaseId': 41, 'status': 'completed', 'conclusion': 'success'})
    passed = [{'name': name, 'conclusion': 'skipped' if name == missing else 'success'} for name in release.REQUIRED_STEPS]
    replies = iter([{'private': private, 'default_branch': 'main'}, runs, {'jobs': [{'name': 'verify', 'conclusion': 'success', 'steps': passed}]}])
    monkeypatch.setattr(release, 'command', lambda *args: json.dumps(next(replies)))
    return run


def test_release_requires_green_ci_and_every_security_step(release, monkeypatch):
    run = ci_fixture(release, monkeypatch)
    assert release.verify_ci(REPOSITORY, COMMIT) == run['url']


@pytest.mark.parametrize('values', [
    {'private': False}, {'status': 'in_progress'}, {'conclusion': 'failure'},
    {'conclusion': 'cancelled'}, {'sha': 'b' * 40},
    {'conclusion': 'failure', 'older_green': True},
    {'missing': 'Gate deployable images on high/critical advisories'},
    {'missing': 'Verify private HTTPS/SSO deployment'},
    {'missing': 'Verify public browser demo'},
])
def test_release_fails_closed_on_ci_failures(release, monkeypatch, values):
    ci_fixture(release, monkeypatch, **values)
    with pytest.raises(release.ReleaseError):
        release.verify_ci(REPOSITORY, COMMIT)


def test_release_checks_clean_source(release, monkeypatch):
    monkeypatch.setattr(release, 'command', lambda *args: ' M source.py\n')
    with pytest.raises(release.ReleaseError, match='Commit all'):
        release.source_commit()


def test_release_image_manifest_does_not_include_environment_or_secrets(release, monkeypatch):
    metadata = {'Id': 'sha256:' + 'c' * 64, 'Os': 'linux', 'Architecture': 'amd64', 'Config': {'Env': ['SENSITIVE_TEST=private-marker']}}
    monkeypatch.setattr(release, 'command', lambda *args: json.dumps([metadata]))
    images = release.image_identities()
    assert set(images) == set(release.COMPONENTS)
    assert 'private-marker' not in json.dumps(images)


def test_release_rejects_unexercised_architecture(release, monkeypatch):
    monkeypatch.setattr(release, 'command', lambda *args: json.dumps([{'Id': 'sha256:' + 'c' * 64, 'Os': 'linux', 'Architecture': 'arm64'}]))
    with pytest.raises(release.ReleaseError, match='amd64'):
        release.image_identities()


def test_release_checks_images_and_does_not_overwrite_manifest(release, monkeypatch, tmp_path, capsys):
    output = tmp_path / 'release.json'
    monkeypatch.setattr(sys, 'argv', ['check-release.py', '--output', str(output)])
    monkeypatch.setattr(release, 'source_commit', lambda: COMMIT)
    monkeypatch.setattr(release, 'verify_ci', lambda *args: 'https://github.com/aadvik1864/beacon/actions/runs/42')
    images = {'api': {'image_id': 'sha256:' + 'd' * 64}}
    monkeypatch.setattr(release, 'image_identities', lambda: images)
    calls = []
    monkeypatch.setattr(release.subprocess, 'run', lambda args, **kwargs: calls.append(args))
    assert release.main() == 0
    original = output.read_text()
    assert json.loads(original)['x-beacon-release']['source_commit'] == COMMIT
    assert json.loads(original)['services']['api']['image'] == images['api']['image_id']
    assert output.stat().st_mode & 0o777 == 0o600
    assert [Path(args[1]).name for args in calls] == ['test-deployment.py', 'scan-images.py']
    assert release.main() == 1
    assert output.read_text() == original
    assert len(calls) == 2
    assert 'Traceback' not in capsys.readouterr().err


def test_release_does_not_record_images_if_scan_fails(release, monkeypatch, tmp_path, capsys):
    output = tmp_path / 'release.json'
    monkeypatch.setattr(sys, 'argv', ['check-release.py', '--output', str(output)])
    monkeypatch.setattr(release, 'source_commit', lambda: COMMIT)
    monkeypatch.setattr(release, 'verify_ci', lambda *args: 'verified')
    monkeypatch.setattr(release, 'image_identities', lambda: {})
    def fail(args, **kwargs):
        if Path(args[1]).name == 'scan-images.py':
            raise subprocess.CalledProcessError(1, ['private-command'], output='private-output-marker')
    monkeypatch.setattr(release.subprocess, 'run', fail)
    assert release.main() == 1
    assert not output.exists()
    assert 'private-output-marker' not in capsys.readouterr().err


@pytest.mark.parametrize('changed', ['source', 'images', 'ci'])
def test_release_does_not_record_changed_source_images_or_ci(release, monkeypatch, tmp_path, changed):
    output = tmp_path / 'release.json'
    monkeypatch.setattr(sys, 'argv', ['check-release.py', '--output', str(output)])
    commits = iter([COMMIT, 'b' * 40 if changed == 'source' else COMMIT])
    images = iter([{}, {'changed': True} if changed == 'images' else {}])
    runs = iter(['first-run', 'new-run' if changed == 'ci' else 'first-run'])
    monkeypatch.setattr(release, 'source_commit', lambda: next(commits))
    monkeypatch.setattr(release, 'image_identities', lambda: next(images))
    monkeypatch.setattr(release, 'verify_ci', lambda *args: next(runs))
    monkeypatch.setattr(release.subprocess, 'run', lambda *args, **kwargs: None)
    assert release.main() == 1
    assert not output.exists()


def test_release_does_not_accept_pull_request_verification(release, monkeypatch):
    replies = iter([{'private': True, 'default_branch': 'main'}, [{'event': 'pull_request', 'headSha': COMMIT, 'status': 'completed', 'conclusion': 'success'}]])
    monkeypatch.setattr(release, 'command', lambda *args: json.dumps(next(replies)))
    with pytest.raises(release.ReleaseError, match='No default-branch'):
        release.verify_ci(REPOSITORY, COMMIT)
