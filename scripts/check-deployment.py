"""Offline deployment preflight. Prints errors without secret/configuration values."""

import argparse
import base64
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from beacon.config import ConfigurationError, Settings  # noqa: E402


def require(condition, message):
    if not condition:
        raise ConfigurationError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=ROOT / 'deploy/.env')
    args = parser.parse_args()
    try:
        result = subprocess.run(['docker', 'compose', '--env-file', str(args.env_file), '-f', str(ROOT / 'deploy/compose.yaml'), 'config', '--format', 'json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        require(result.returncode == 0, 'Compose configuration is incomplete. Check deploy/.env and required variables.')
        config = json.loads(result.stdout)
        services = config['services']
        origin = services['api']['environment']['BEACON_PUBLIC_ORIGIN']
        host = urlsplit(origin).hostname or ''
        require('.' in host and not host.endswith(('.example.com', '.localhost', '.example', '.invalid')), 'Set a real DNS hostname, not an example or local hostname.')
        issuer_arg = next(value for value in services['sso']['command'] if value.startswith('--oidc-issuer-url='))
        issuer = urlsplit(issuer_arg.split('=', 1)[1])
        require(issuer.scheme == 'https' and issuer.hostname and not issuer.username and not issuer.password and not issuer.query and not issuer.fragment, 'OIDC issuer must be HTTPS without credentials, query, or fragment.')
        require(not issuer.hostname.endswith(('.example.com', '.invalid', '.example')), 'Set a real OIDC issuer, not an example hostname.')
        values = {}
        for name, definition in config['secrets'].items():
            path = Path(definition['file']).resolve()
            require(path.is_absolute() and not path.is_relative_to(ROOT), 'Secrets must be outside the repository.')
            info = path.stat()
            require(stat.S_ISREG(info.st_mode) and info.st_uid == 10001 and stat.S_IMODE(info.st_mode) & 0o077 == 0, 'Secret files must be regular files owned by UID 10001 with no group/other access.')
            require(info.st_size <= 16384, 'Secret configuration file is too large.')
            values[name] = path.read_text().strip()
        Settings(production=True, origins=frozenset({origin}), hosts=(host,), gateway_secret=values['gateway_key'], csrf_secret=values['csrf_key'], allowed_emails=frozenset(values['allowed_emails'].splitlines()))
        require(len(base64.urlsafe_b64decode(values['cookie_key'])) == 32, 'SSO cookie key must encode exactly 32 random bytes.')
        require(8 <= len(values['oidc_client_secret']) <= 4096 and '\n' not in values['oidc_client_secret'], 'OIDC client secret is missing or malformed.')
        redis = re.fullmatch(r'requirepass ([A-Za-z0-9_-]{43,128})', values['redis_config'])
        require(redis is not None, 'Redis authentication configuration is malformed.')
        require(values['sso_store_config'] == f'redis_password = "{redis[1]}"', 'SSO and Redis authentication configuration must agree.')
        require(len({values['gateway_key'], values['csrf_key'], values['cookie_key'], redis[1]}) == 4, 'Deployment keys must be independent.')
        for name in ('api', 'gateway', 'sso', 'sessions'):
            service = services[name]
            require(not service.get('ports'), 'Only the HTTPS edge may publish ports.')
            require(service.get('read_only') and service.get('user') == '10001:10001' and 'ALL' in service.get('cap_drop', []), 'Private services must retain container hardening.')
        require(config['networks']['backend']['internal'] and config['networks']['sessions']['internal'], 'Backend and session networks must remain internal.')
    except ConfigurationError as error:
        # These errors are authored constant messages, never rejected values.
        print(f'Deployment preflight failed: {error} See docs/deployment.md.', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, StopIteration):
        # No traceback, file contents, arguments, or exception repr in output.
        print('Deployment preflight failed. Check required HTTPS settings, external secret files (UID 10001, mode 0400), independent keys, and network hardening. See docs/deployment.md.', file=sys.stderr)
        return 1
    print('Offline deployment configuration checks passed. Real-provider login, MFA, TLS, and image/security gates are still required before launch.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
