"""Read-only host check with no cookies, credentials, request bodies, or telemetry uploads."""

import argparse
import json
from pathlib import Path
import re
import socket
import ssl
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = ('api', 'gateway', 'edge', 'sso', 'sessions')


class HealthError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise HealthError(message)


def command(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, 'Local container inspection failed.')
    return result.stdout


def check_container(component, metadata, memory_percent):
    state = metadata['State']
    require(state.get('Running') is True and not state.get('OOMKilled'), f'{component}: container is stopped or was killed for memory pressure.')
    health = state.get('Health', {}).get('Status')
    require(health == 'healthy' if component in ('api', 'gateway', 'sessions') else health in (None, 'healthy'), f'{component}: container health check is not passing.')
    require(metadata['RestartCount'] < 3, f'{component}: repeated container restarts require review.')
    require(re.fullmatch(r'\d+(?:\.\d+)?%', memory_percent), 'Container memory measurement is unavailable.')
    require(float(memory_percent[:-1]) < 85, f'{component}: container memory use is at or above 85 percent.')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def check_https(origin):
    url = urlsplit(origin)
    host = url.hostname or ''
    require(url.scheme == 'https' and '.' in host and url.netloc == host and url.path in ('', '/') and not url.query and not url.fragment, 'Configure a canonical public HTTPS origin before checking host health.')
    context = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=5) as raw:
        with context.wrap_socket(raw, server_hostname=host) as secure:
            expires = ssl.cert_time_to_seconds(secure.getpeercert()['notAfter'])
    require(expires - time.time() > 14 * 86400, 'Public TLS certificate expires within 14 days; check renewal.')
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=context), NoRedirect())
    try:
        with opener.open(Request(origin.rstrip('/') + '/api/health', headers={'Accept': 'application/json'}), timeout=5) as response:
            status = response.status
            cache = response.headers.get('Cache-Control', '')
    except HTTPError as response:
        status = response.code
        cache = response.headers.get('Cache-Control', '')
        response.close()
    require(status == 401 and 'no-store' in cache.lower(), 'HTTPS edge must reject anonymous API access with a non-cacheable 401 response.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=ROOT / 'deploy/.env')
    args = parser.parse_args()
    try:
        compose = ('docker', 'compose', '--env-file', str(args.env_file), '-f', str(ROOT / 'deploy/compose.yaml'))
        config = json.loads(command(*compose, 'config', '--format', 'json'))
        for component in COMPONENTS:
            identifiers = command(*compose, 'ps', '--all', '-q', component).split()
            require(len(identifiers) == 1, f'{component}: exactly one container must exist.')
            metadata = json.loads(command('docker', 'inspect', identifiers[0]))[0]
            stats = json.loads(command('docker', 'stats', '--no-stream', '--format', '{{json .}}', identifiers[0]))
            check_container(component, metadata, stats['MemPerc'])
        check_https(config['services']['api']['environment']['BEACON_PUBLIC_ORIGIN'])
    except HealthError as error:
        print(f'Host health check failed: {error}', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, IndexError, TypeError, subprocess.SubprocessError):
        print('Host health check failed. Check local tooling, stack status, public TLS, and memory; no configuration values are logged.', file=sys.stderr)
        return 1
    print('Private stack liveness, container memory, and public TLS checks passed. Provider/MFA acceptance is separate.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
