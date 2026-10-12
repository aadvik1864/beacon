import asyncio
import logging
import secrets
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from beacon.api import create_app
from beacon.config import ConfigurationError, Settings
from beacon.models import SimulationInput
from beacon.repository import RunRepository
from beacon.security import BodyLimitMiddleware, RequestLimiter, SessionTokens


@pytest.fixture
def settings():
    return Settings(
        production=True, origins=frozenset({'https://beacon.example.com'}), hosts=('beacon.example.com',),
        gateway_secret=secrets.token_urlsafe(48), csrf_secret=secrets.token_urlsafe(48),
        allowed_emails=frozenset({'alice@example.com', 'bob@example.com'}),
    )


@pytest.fixture
def production(settings):
    app = create_app(settings)
    with TestClient(app, base_url='https://beacon.example.com') as client:
        yield client, app


def gateway(settings, identity='alice@example.com'):
    return {'X-Beacon-Gateway': settings.gateway_secret, 'X-Beacon-Identity': identity}


def session(client, settings, identity='alice@example.com'):
    headers = gateway(settings, identity)
    headers['X-Beacon-Token'] = client.get('/api/session', headers=headers).json()['token']
    headers['Origin'] = 'https://beacon.example.com'
    return headers


def payload(**changes):
    return {'idempotency_key': str(uuid4()), 'policy': 'Employees receive 20 days of leave.', 'question': 'How much leave?', **changes}


@pytest.mark.parametrize('path', ['/api/health', '/api/session', '/api/capabilities', '/api/openapi.json', '/api/docs', '/api/simulations'])
def test_production_routes_require_authentication(production, path):
    client, _ = production
    response = client.get(path)
    assert response.status_code == 401
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['strict-transport-security'] == 'max-age=31536000'


@pytest.mark.parametrize('changes', [
    {'X-Beacon-Gateway': 'incorrect'}, {'X-Beacon-Identity': 'mallory@example.com'},
    {'X-Beacon-Identity': 'ALICE@example.com'}, {'X-Beacon-Identity': 'alice@example.com,bob@example.com'},
])
def test_forged_or_unlisted_identity_fails(production, settings, changes):
    client, _ = production
    assert client.get('/api/session', headers={**gateway(settings), **changes}).status_code in {401, 403}


def test_session_never_returns_identity_or_server_secrets(production, settings):
    client, _ = production
    response = client.get('/api/session', headers=gateway(settings))
    assert response.status_code == 200
    assert list(response.json()) == ['token']
    for value in (settings.csrf_secret, settings.gateway_secret, 'alice@example.com'):
        assert value not in response.text


def test_user_bound_csrf_and_cache_isolation(production, settings):
    client, _ = production
    alice, bob = session(client, settings), session(client, settings, 'bob@example.com')
    data = payload()
    assert client.post('/api/simulations', json=data, headers={**bob, 'X-Beacon-Token': alice['X-Beacon-Token']}).status_code == 403
    first = client.post('/api/simulations', json=data, headers=alice).json()
    second = client.post('/api/simulations', json=data, headers=bob).json()
    assert first['id'] != second['id']
    assert client.post('/api/simulations', json=data, headers=alice).json() == first


def test_clear_only_deletes_callers_cache(production, settings):
    client, app = production
    alice, bob = session(client, settings), session(client, settings, 'bob@example.com')
    data = payload()
    for headers in (alice, bob):
        assert client.post('/api/simulations', json=data, headers=headers).status_code == 200
    assert len(app.state.runs._records) == 2
    assert client.post('/api/captures/clear', headers=alice).json() == {'cleared': True}
    assert len(app.state.runs._records) == 1
    assert client.post('/api/captures/clear', headers=gateway(settings)).status_code == 403


@pytest.mark.parametrize('origin', [None, 'http://beacon.example.com', 'https://beacon.example.com.evil.example', 'null', 'https://evil.example'])
def test_production_mutations_require_exact_origin(production, settings, origin):
    client, _ = production
    headers = session(client, settings)
    if origin is None:
        del headers['Origin']
    else:
        headers['Origin'] = origin
    assert client.post('/api/simulations', json=payload(), headers=headers).status_code == 403


def test_cross_site_fetch_metadata_denied(production, settings):
    client, _ = production
    assert client.get('/api/session', headers={**gateway(settings), 'Sec-Fetch-Site': 'cross-site'}).status_code == 403


def test_production_disables_docs_and_cors(production, settings):
    client, _ = production
    for path in ('/api/docs', '/api/openapi.json'):
        assert client.get(path, headers=gateway(settings)).status_code == 404
    response = client.get('/api/health', headers=gateway(settings))
    assert response.json()['access_mode'] == 'sso'
    assert 'access-control-allow-origin' not in response.headers
    assert client.get('/api/health', headers={**gateway(settings), 'Host': 'evil.example'}).status_code == 400


def test_duplicate_headers_rejected(production, settings):
    client, _ = production
    headers = [('X-Beacon-Gateway', settings.gateway_secret), ('X-Beacon-Gateway', settings.gateway_secret), ('X-Beacon-Identity', 'alice@example.com')]
    assert client.get('/api/session', headers=headers).status_code == 400


def test_internal_health_is_minimal(production):
    client, _ = production
    assert client.get('/healthz').json() == {'status': 'ok'}


@pytest.mark.parametrize('secret', [
    'AKIA' + 'A' * 16, 'ASIA' + 'B' * 16, '-----BEGIN PRIVATE KEY-----',
    'ghp_' + 'a' * 36, 'github_pat_' + 'a' * 40, 'https://user:password@example.com',
])
def test_credentials_and_invalid_input_are_not_echoed(production, settings, secret, caplog):
    client, _ = production
    with caplog.at_level(logging.INFO):
        response = client.post('/api/simulations', json=payload(policy=secret), headers=session(client, settings))
    assert response.status_code == 422
    assert secret not in response.text and secret not in caplog.text
    assert 'alice@example.com' not in caplog.text
    assert settings.gateway_secret not in caplog.text
    assert settings.csrf_secret not in caplog.text


def test_unexpected_errors_are_generic_and_not_logged(production, settings, monkeypatch, caplog):
    client, app = production
    def fail(*args, **kwargs):
        raise RuntimeError('sensitive-super-secret-marker')
    monkeypatch.setattr(app.state.runs, 'execute', fail)
    with caplog.at_level(logging.INFO):
        response = client.post('/api/simulations', json=payload(), headers=session(client, settings))
    assert response.status_code == 500
    assert response.json() == {'detail': 'Request could not be completed.'}
    assert response.headers['cache-control'] == 'no-store'
    assert 'sensitive-super-secret-marker' not in response.text + caplog.text


def test_tokens_expire_and_cannot_be_tampered_with(monkeypatch):
    monkeypatch.setattr('beacon.security.time.time', lambda: 1800000000)
    tokens = SessionTokens(secrets.token_urlsafe(48))
    token = tokens.issue('alice')
    assert tokens.valid('alice', token)
    assert not tokens.valid('bob', token)
    assert not tokens.valid('alice', token[:-1] + ('1' if token[-1] != '1' else '2'))
    assert not tokens.valid('alice', 'é' * 100000)
    monkeypatch.setattr('beacon.security.time.time', lambda: 1800000900)
    assert not tokens.valid('alice', token)


def test_cached_inputs_expire_even_without_new_runs(monkeypatch):
    now = [0]
    monkeypatch.setattr('beacon.repository.time.monotonic', lambda: now[0])
    repository = RunRepository(ttl=300)
    repository.execute(SimulationInput(**payload()))
    now[0] = 301
    repository.purge_expired()
    assert not repository._records


def test_request_limiter_is_per_user_and_global(monkeypatch):
    now = [0]
    monkeypatch.setattr('beacon.security.time.monotonic', lambda: now[0])
    limiter = RequestLimiter(per_user=2, total=3)
    assert limiter.allow('alice') and limiter.allow('alice')
    assert not limiter.allow('alice')
    assert limiter.allow('bob') and not limiter.allow('bob')
    now[0] = 61
    assert limiter.allow('alice')
    assert len(limiter.users) == 1


def test_chunked_body_limit_without_content_length():
    messages = iter([{'type': 'http.request', 'body': b'x' * 20000, 'more_body': True}] * 2)
    output = []
    async def receive():
        return next(messages)
    async def send(message):
        output.append(message)
    async def app(*args):
        pytest.fail('Oversized body reached application')
    asyncio.run(BodyLimitMiddleware(app)({'type': 'http', 'method': 'POST', 'headers': []}, receive, send))
    assert output[0]['status'] == 413


@pytest.mark.parametrize('changes', [
    {'origins': frozenset({'http://beacon.example.com'})}, {'gateway_secret': 'short'},
    {'allowed_emails': frozenset()}, {'allowed_emails': frozenset({'*@example.com'})},
    {'origins': frozenset({'https://beacon.example.com/path'})}, {'hosts': ('*',)},
])
def test_invalid_production_settings_fail_closed(settings, changes):
    with pytest.raises(ConfigurationError):
        replace(settings, **changes)


def test_environment_mode_cannot_silently_downgrade(monkeypatch):
    monkeypatch.setenv('BEACON_ENV', 'staging')
    with pytest.raises(ConfigurationError):
        Settings.from_env()
    monkeypatch.setenv('BEACON_ENV', 'development')
    monkeypatch.setenv('BEACON_PUBLIC_ORIGIN', 'https://beacon.example.com')
    with pytest.raises(ConfigurationError):
        Settings.from_env()


def test_secret_files_and_repr_do_not_leak(monkeypatch, tmp_path, settings):
    monkeypatch.setenv('BEACON_ENV', 'production')
    monkeypatch.setenv('BEACON_PUBLIC_ORIGIN', 'https://beacon.example.com')
    for variable, content in (
        ('BEACON_GATEWAY_SECRET_FILE', settings.gateway_secret), ('BEACON_CSRF_SECRET_FILE', settings.csrf_secret),
        ('BEACON_ALLOWED_EMAILS_FILE', 'alice@example.com\nbob@example.com'),
    ):
        path = tmp_path / variable
        path.write_text(content)
        monkeypatch.setenv(variable, str(path))
    loaded = Settings.from_env()
    assert loaded == settings
    assert settings.gateway_secret not in repr(loaded)
    assert settings.csrf_secret not in repr(loaded)
    assert 'alice@example.com' not in repr(loaded)


def test_small_concurrent_load_returns_bounded_results_or_backpressure(production, settings):
    client, app = production
    headers = session(client, settings)
    def run(index):
        return client.post('/api/simulations', json=payload(), headers=headers).status_code
    with ThreadPoolExecutor(max_workers=8) as executor:
        statuses = list(executor.map(run, range(24)))
    assert set(statuses) <= {200, 429}
    assert 200 in statuses
    assert len(app.state.runs._records) <= 20


def test_request_throttle_is_enforced_before_body_parsing(production, settings):
    client, _ = production
    headers = gateway(settings)
    responses = [client.get('/api/health', headers=headers).status_code for _ in range(121)]
    assert responses[-1] == 429


def test_malformed_json_and_excessive_headers_are_redacted(production, settings):
    client, _ = production
    response = client.post('/api/simulations', content=b'{"policy": "private-input-marker', headers={**session(client, settings), 'Content-Type': 'application/json'})
    assert response.status_code == 422
    assert 'private-input-marker' not in response.text
    oversized = client.get('/api/session', headers={**gateway(settings), 'X-Untrusted': 'x' * 17000})
    assert oversized.status_code == 431


def test_missing_csrf_is_denied_before_json_validation(production, settings):
    client, _ = production
    response = client.post('/api/simulations', content=b'invalid private JSON', headers={**gateway(settings), 'Origin': 'https://beacon.example.com', 'Content-Type': 'application/json'})
    assert response.status_code == 403
    assert 'invalid private JSON' not in response.text


def test_slow_streaming_body_times_out(monkeypatch):
    timeout = asyncio.timeout
    monkeypatch.setattr(asyncio, 'timeout', lambda _: timeout(0))
    output = []
    async def receive():
        await asyncio.Event().wait()
    async def send(message):
        output.append(message)
    async def app(*args):
        pytest.fail('Timed-out request reached application')
    asyncio.run(BodyLimitMiddleware(app)({'type': 'http', 'method': 'POST', 'headers': []}, receive, send))
    assert output[0]['status'] == 408
