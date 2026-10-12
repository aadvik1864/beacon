"""TEST ONLY: synthetic HTTPS OIDC issuer. Never expose or use for authentication."""

import base64
import hashlib
import hmac
import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import ssl
import subprocess
import time
from urllib.parse import parse_qs, urlencode, urlsplit

ROOT = Path('/fixture')
ISSUER = 'https://oidc.localhost:39443'
CODES = {}


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ssl.SSLEOFError):
            pass

    def do_GET(self):
        url = urlsplit(self.path)
        query = {key: values[0] for key, values in parse_qs(url.query).items()}
        if url.path == '/.well-known/openid-configuration':
            return self.reply({
                'issuer': ISSUER, 'authorization_endpoint': ISSUER + '/authorize',
                'token_endpoint': ISSUER + '/token', 'jwks_uri': ISSUER + '/keys',
                'userinfo_endpoint': ISSUER + '/userinfo', 'response_types_supported': ['code'],
                'subject_types_supported': ['public'], 'id_token_signing_alg_values_supported': ['RS256'],
                'code_challenge_methods_supported': ['S256'],
            })
        if url.path == '/keys':
            return self.reply(json.loads((ROOT / 'jwks.json').read_text()))
        if url.path == '/authorize':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            links = ''.join(f'<p><a href="/approve?{html.escape(urlencode({**query, "user": user}))}">{user}</a></p>' for user in ('alice', 'bob', 'unlisted', 'unverified', 'bad-nonce', 'bad-signature'))
            return self.wfile.write(f'<h1>Synthetic test identity provider</h1>{links}'.encode())
        if url.path == '/approve':
            code = secrets.token_urlsafe(32)
            CODES[code] = query
            redirect = query['redirect_uri'] + '?' + urlencode({'code': code, 'state': query['state']})
            self.send_response(302)
            self.send_header('Location', redirect)
            return self.end_headers()
        if url.path == '/userinfo':
            return self.reply({'sub': 'fixture', 'email': 'alice@example.com', 'email_verified': True})
        return self.reply({'error': 'not_found'}, 404)

    def do_POST(self):
        if urlsplit(self.path).path != '/token':
            return self.reply({'error': 'not_found'}, 404)
        query = {key: values[0] for key, values in parse_qs(self.rfile.read(int(self.headers.get('Content-Length', '0'))).decode()).items()}
        code = CODES.get(query.get('code', ''))
        if code is None:
            return self.reply({'error': 'invalid_grant'}, 400)
        challenge = b64(hashlib.sha256(query.get('code_verifier', '').encode()).digest())
        if not hmac.compare_digest(challenge, code.get('code_challenge', '')):
            return self.reply({'error': 'invalid_grant'}, 400)
        secret = (ROOT / 'oidc_client_secret').read_text()
        basic = 'Basic ' + base64.b64encode(('beacon-test:' + secret).encode()).decode()
        if self.headers.get('Authorization') != basic and query.get('client_secret') != secret:
            return self.reply({'error': 'invalid_client'}, 401)
        CODES.pop(query['code'])
        user = code['user']
        email = 'bob@example.com' if user == 'bob' else 'unlisted@example.com' if user == 'unlisted' else 'alice@example.com'
        now = int(time.time())
        claims = {'iss': ISSUER, 'aud': 'beacon-test', 'sub': user, 'iat': now, 'exp': now + 3600, 'email': email, 'email_verified': user != 'unverified', 'nonce': code.get('nonce', '')}
        if user == 'bad-nonce':
            claims['nonce'] = 'wrong-nonce'
        payload = b64(json.dumps({'alg': 'RS256', 'kid': 'fixture'}).encode()) + '.' + b64(json.dumps(claims).encode())
        signature = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', str(ROOT / 'signing.key')], input=payload.encode(), stdout=subprocess.PIPE, check=True).stdout
        if user == 'bad-signature':
            signature = bytes([signature[0] ^ 1]) + signature[1:]
        return self.reply({'access_token': 'synthetic-access-token', 'token_type': 'Bearer', 'expires_in': 3600, 'id_token': payload + '.' + b64(signature)})


server = ThreadingHTTPServer(('0.0.0.0', 39443), Handler)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(ROOT / 'oidc.crt', ROOT / 'oidc.key')
server.socket = tls.wrap_socket(server.socket, server_side=True)
server.serve_forever()
