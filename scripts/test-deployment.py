"""Build and verify the real private stack using synthetic HTTPS OIDC on loopback."""

import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[1]


def command(*args, env=None):
    result = subprocess.run(args, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode:
        # Commands operate only on generated synthetic fixture data.
        raise RuntimeError(f'{args[0]} failed:\n{result.stdout[-6000:]}')
    return result.stdout


def write(path, content):
    path.write_text(content)
    # Fixture directory is 0700. Synthetic bind-mounted files must be readable
    # by UID 10001. Production files instead use ownership 10001 and mode 0400.
    path.chmod(0o444)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-build', action='store_true')
    args = parser.parse_args()
    if not args.skip_build:
        for component in ('api', 'gateway', 'edge', 'sso', 'sessions'):
            command('docker', 'build', '-f', f'deploy/Dockerfile.{component}', '-t', f'beacon-{component}:security-test', '.')
    bare_api = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', 'beacon-api:security-test'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=15)
    assert bare_api.returncode != 0 and 'ConfigurationError' in bare_api.stdout, 'API image must refuse startup without production secrets'
    with tempfile.TemporaryDirectory(prefix='beacon-sso-', dir='/tmp/opencode') as tmp:
        directory = Path(tmp)
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        write(directory / 'signing.key', key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode())
        public = key.public_key().public_numbers()
        encode_int = lambda value: base64.urlsafe_b64encode(value.to_bytes((value.bit_length() + 7) // 8, 'big')).rstrip(b'=').decode()
        write(directory / 'jwks.json', json.dumps({'keys': [{'kty': 'RSA', 'kid': 'fixture', 'use': 'sig', 'alg': 'RS256', 'n': encode_int(public.n), 'e': encode_int(public.e)}]}))
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'oidc.localhost')])
        now = datetime.now(timezone.utc)
        cert = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('oidc.localhost')]), False).add_extension(x509.BasicConstraints(ca=True, path_length=None), True).sign(key, hashes.SHA256())
        write(directory / 'oidc.crt', cert.public_bytes(serialization.Encoding.PEM).decode())
        write(directory / 'oidc.key', (directory / 'signing.key').read_text())
        for key_name in ('gateway_key', 'csrf_key', 'oidc_client_secret'):
            write(directory / key_name, secrets.token_urlsafe(48))
        write(directory / 'cookie_key', base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())
        write(directory / 'allowed_emails', 'alice@example.com\nbob@example.com')
        redis_key = secrets.token_urlsafe(48)
        write(directory / 'redis_config', f'requirepass {redis_key}\n')
        write(directory / 'sso_store_config', f'redis_password = "{redis_key}"\n')
        fixture = directory / 'fixture'
        fixture.mkdir(mode=0o755)
        for name in ('signing.key', 'jwks.json', 'oidc.crt', 'oidc.key', 'oidc_client_secret'):
            write(fixture / name, (directory / name).read_text())
        env = {**os.environ, 'BEACON_HOST': 'localhost', 'OIDC_ISSUER_URL': 'https://oidc.localhost:39443', 'OIDC_CLIENT_ID': 'beacon-test', 'BEACON_SECRETS_DIR': str(directory)}
        config = json.loads(command('docker', 'compose', '-f', 'deploy/compose.yaml', 'config', '--format', 'json', env=env))
        project = 'beacon-security-' + secrets.token_hex(4)
        config['name'] = project
        for category in ('networks', 'volumes'):
            for label, definition in config[category].items():
                definition['name'] = project + '_' + label
        for service in config['services'].values():
            service['restart'] = 'no'
        for component in ('api', 'gateway', 'edge', 'sso', 'sessions'):
            config['services'][component].pop('build')
            config['services'][component]['image'] = f'beacon-{component}:security-test'
            if component in ('api', 'gateway', 'sessions'):
                config['services'][component].setdefault('healthcheck', {}).update({'interval': '2s', 'timeout': '2s', 'start_period': '5s'})
        config['services']['api']['environment']['BEACON_PUBLIC_ORIGIN'] = 'https://localhost:38443'
        config['services']['edge']['ports'] = [{'target': 8443, 'published': '38443', 'host_ip': '127.0.0.1', 'protocol': 'tcp'}]
        caddy = (ROOT / 'deploy/Caddyfile').read_text().replace('https://{$BEACON_HOST} {', 'https://{$BEACON_HOST}:8443 {\n    tls internal')
        write(directory / 'Caddyfile', caddy)
        config['services']['edge']['volumes'][0]['source'] = str(directory / 'Caddyfile')
        sso = config['services']['sso']
        sso['command'] = [value.replace('https://localhost/oauth2/callback', 'https://localhost:38443/oauth2/callback') for value in sso['command']]
        sso['command'].append('--provider-ca-file=/fixture/oidc.crt')
        sso['volumes'] = [{'type': 'bind', 'source': str(directory / 'oidc.crt'), 'target': '/fixture/oidc.crt', 'read_only': True}]
        sso['depends_on']['oidc'] = {'condition': 'service_started'}
        config['services']['oidc'] = {
            # Test issuer only: OpenSSL CLI signs synthetic ID tokens. Never ship
            # this image/server as part of the production deployment.
            'image': 'python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258',
            'entrypoint': ['python', '/fixture/server.py'],
            'user': '10001:10001', 'read_only': True, 'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'],
            'networks': {'edge': {'aliases': ['oidc.localhost']}},
            'ports': [{'target': 39443, 'published': '39443', 'host_ip': '127.0.0.1', 'protocol': 'tcp'}],
            'healthcheck': {
                'test': ['CMD', 'python', '-c', "import ssl; from urllib.request import urlopen; urlopen('https://oidc.localhost:39443/.well-known/openid-configuration', context=ssl.create_default_context(cafile='/fixture/oidc.crt'), timeout=2).read()"],
                'interval': '2s', 'timeout': '3s', 'start_period': '5s',
            },
            'volumes': [{'type': 'bind', 'source': str(fixture), 'target': '/fixture', 'read_only': True}],
        }
        write(fixture / 'server.py', (ROOT / 'tests/deployment/oidc_fixture.py').read_text())
        compose = directory / 'compose.json'
        write(compose, json.dumps(config))
        try:
            command('docker', 'compose', '-f', str(compose), 'up', '-d', '--wait', '--wait-timeout', '90')
            command('node', 'tests/deployment/browser.mjs')
            # Container metadata verifies no backend public ports and hardening.
            for name in ('api', 'gateway', 'sso', 'sessions'):
                container = command('docker', 'compose', '-f', str(compose), 'ps', '-q', name).strip()
                detail = json.loads(command('docker', 'inspect', container))[0]
                assert not detail['HostConfig']['PortBindings']
                assert detail['Config']['User'] == '10001:10001'
                assert detail['HostConfig']['ReadonlyRootfs']
                assert 'ALL' in detail['HostConfig']['CapDrop']
            logs = command('docker', 'compose', '-f', str(compose), 'logs', '--no-color')
            for value in ('alice@example.com', 'bob@example.com', 'BEACON_PRIVATE_INPUT_MARKER'):
                assert value not in logs, 'Sensitive input or identity leaked into logs'
            for name in ('gateway_key', 'csrf_key', 'cookie_key', 'oidc_client_secret'):
                assert (directory / name).read_text() not in logs, 'Secret leaked into logs'
            assert redis_key not in logs, 'Redis authentication key leaked into logs'
            print('Private HTTPS/SSO container and browser security checks passed (synthetic issuer only).')
        except Exception:
            print(command('docker', 'compose', '-f', str(compose), 'logs', '--no-color')[-6000:])
            raise
        finally:
            command('docker', 'compose', '-f', str(compose), 'down', '--volumes', '--remove-orphans')


if __name__ == '__main__':
    main()
