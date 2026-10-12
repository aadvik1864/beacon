import importlib.util
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def health():
    spec = importlib.util.spec_from_file_location('beacon_health_check', ROOT / 'scripts/check-health.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def container(**changes):
    return {'State': {'Running': True, 'OOMKilled': False, 'Health': {'Status': 'healthy'}}, 'RestartCount': 0, **changes}


def test_monitor_accepts_healthy_private_containers(health):
    for component in health.COMPONENTS:
        health.check_container(component, container(), '20.5%')
    health.check_container('sso', container(State={'Running': True}), '1%')


@pytest.mark.parametrize('metadata,memory', [
    (container(State={'Running': False}), '1%'),
    (container(State={'Running': True, 'OOMKilled': True}), '1%'),
    (container(State={'Running': True, 'Health': {'Status': 'unhealthy'}}), '1%'),
    (container(State={'Running': True}), '1%'),
    (container(RestartCount=3), '1%'), (container(), '85%'),
    (container(), '99.9%'), (container(), '--'),
])
def test_monitor_rejects_failures_and_pressure(health, metadata, memory):
    with pytest.raises(health.HealthError):
        health.check_container('api', metadata, memory)


def fake_https(health, monkeypatch, *, status=401, cache='no-store', days=30):
    class Connection:
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def getpeercert(self):
            return {'notAfter': 'fixture'}
    class Context:
        def wrap_socket(self, raw, server_hostname):
            assert server_hostname == 'beacon.company.test'
            return Connection()
    class Opener:
        def open(self, request, timeout):
            assert request.full_url == 'https://beacon.company.test/api/health'
            assert request.data is None
            assert not request.has_header('Cookie')
            assert not request.has_header('Authorization')
            raise HTTPError(request.full_url, status, 'fixture', {'Cache-Control': cache}, None)
    monkeypatch.setattr(health.socket, 'create_connection', lambda *a, **k: Connection())
    monkeypatch.setattr(health.ssl, 'create_default_context', Context)
    monkeypatch.setattr(health.ssl, 'cert_time_to_seconds', lambda value: time.time() + days * 86400)
    monkeypatch.setattr(health, 'build_opener', lambda *args: Opener())


def test_monitor_checks_verified_tls_and_anonymous_denial(health, monkeypatch):
    fake_https(health, monkeypatch)
    health.check_https('https://beacon.company.test')
    assert health.NoRedirect().redirect_request(None, None, None, None, None, None) is None


@pytest.mark.parametrize('values', [{'status': 200}, {'status': 302}, {'status': 503}, {'cache': 'public'}, {'days': 10}])
def test_monitor_fails_on_bypass_redirect_outage_or_expiring_tls(health, monkeypatch, values):
    fake_https(health, monkeypatch, **values)
    with pytest.raises(health.HealthError):
        health.check_https('https://beacon.company.test')


@pytest.mark.parametrize('origin', ['http://beacon.company.test', 'https://localhost', 'https://beacon.company.test?token=private-marker', 'https://user:private-marker@beacon.company.test'])
def test_monitor_refuses_noncanonical_origins(health, origin):
    with pytest.raises(health.HealthError):
        health.check_https(origin)


def test_monitor_errors_do_not_echo_configuration_or_exceptions(health, monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['check-health.py'])
    def fail(*args):
        raise OSError('private-marker')
    monkeypatch.setattr(health, 'command', fail)
    assert health.main() == 1
    output = capsys.readouterr()
    assert 'private-marker' not in output.out + output.err
    assert 'Traceback' not in output.err


def test_monitor_checks_every_service_without_modifying_the_stack(health, monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['check-health.py'])
    calls = []
    def command(*args):
        calls.append(args)
        if 'config' in args:
            return json.dumps({'services': {'api': {'environment': {'BEACON_PUBLIC_ORIGIN': 'https://beacon.company.test'}}}})
        if 'ps' in args:
            return 'fixture-container'
        if 'inspect' in args:
            return json.dumps([container()])
        if 'stats' in args:
            return json.dumps({'MemPerc': '1%'})
        pytest.fail('Unexpected modifying command')
    monkeypatch.setattr(health, 'command', command)
    monkeypatch.setattr(health, 'check_https', lambda origin: None)
    assert health.main() == 0
    assert len([args for args in calls if 'inspect' in args]) == 5
