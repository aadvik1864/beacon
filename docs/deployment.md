# Private deployment

Beacon supports a hardened **single-host, invite-only simulation** deployment.
This does not enable AWS, an LLM, or live IAM evidence. No production resources
have been created. Provider/domain setup and the launch checks below are required.

```text
Browser -> Caddy HTTPS :443 -> OAuth2 Proxy (OIDC + explicit email allowlist)
                               |                 |
                        private gateway    private Redis sessions
                               |
                         private FastAPI -> scripted simulation
```

Only Caddy publishes ports (80 redirects to HTTPS; 443 serves the app). API,
gateway, SSO, and Redis have no host ports. API and gateway have no outbound
network. TLS and provider connections verify certificates. The API requires an
independent gateway secret and allowlisted identity even on its private network.
The API image defaults to production mode and refuses to start without secrets;
it never silently boots the development profile when run without configuration.
All containers are non-root, read-only, capability-free, resource-bounded, and
use no-new-privileges. No Docker socket is mounted in application containers.

## Configure your identity provider

Use an OIDC provider with verified email claims, Authorization Code flow, PKCE
S256, and refresh-token support. Create a confidential web client and register
exactly `https://YOUR_HOST/oauth2/callback`. Require MFA and restrict application
assignment in your provider. Use an HTTPS issuer and trusted administrator
accounts. Beacon checks the issuer, audience, signature, nonce, expiry, verified
email, and explicit allowlist through OAuth2 Proxy. Never disable those checks,
add wildcard email domains, trusted-IP bypasses, or skip-auth routes.

Use immutable, provider-controlled verified email addresses. Changing/reassigning
an allowlisted address changes who owns that account. For an organization that
recycles email addresses, review a subject-based identity integration first.

## Prepare a host and secrets

Use a maintained Linux Docker/Compose host with about 2 GiB RAM for this small
private lab. Only amd64 has been exercised end to end. Restrict inbound firewall
rules to HTTPS/HTTP and administrator access; Docker's published ports need their
own firewall review. Set DNS to that host. Do not publish development ports
5173/8000. Host/root/Docker administrators are trusted and can access memory,
secret mounts, and certificates; containers are not a sandbox against host root.

Generate keys **on the deployment host**, outside the repository:

```bash
sudo python3 scripts/init-secrets.py /etc/beacon/secrets
sudoedit /etc/beacon/secrets/allowed_emails
sudoedit /etc/beacon/secrets/oidc_client_secret
```

`allowed_emails` contains one explicit lowercase address per line (1 to 100),
without comments or wildcards. `oidc_client_secret` contains only the provider's
client secret. Do not paste secrets into chat, command arguments, source files,
GitHub issues, `.env`, or any `VITE_` variable.

```bash
sudo chown 10001:10001 /etc/beacon/secrets/*
sudo chmod 0400 /etc/beacon/secrets/*
sudo chmod 0700 /etc/beacon/secrets
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env` with your real DNS hostname, HTTPS issuer, non-secret client ID,
and absolute secrets directory. Docker Compose local secrets are **file mounts,
not an encrypted secret manager**; host ownership/modes matter. All private
containers run as UID 10001 so they can read their assigned files. No secret
values are in Compose environment variables, arguments, frontend assets, or
image layers. The gateway's generated configuration lives only in private tmpfs.

## Verify, then start

Review the diff, run tests and the image gate before publishing any host ports:

```bash
set -euo pipefail
.venv/bin/python -m pytest
python3 -m venv /tmp/opencode/beacon-security-tools
/tmp/opencode/beacon-security-tools/bin/pip install cryptography==50.0.2 pip-audit==2.10.1
/tmp/opencode/beacon-security-tools/bin/pip-audit -r requirements.lock --require-hashes --disable-pip
/tmp/opencode/beacon-security-tools/bin/python scripts/test-deployment.py
python3 scripts/scan-images.py
RELEASE_MANIFEST=/tmp/opencode/beacon-release-$(git rev-parse HEAD).json
/tmp/opencode/beacon-security-tools/bin/python scripts/check-release.py --output "$RELEASE_MANIFEST"
sudo python3 scripts/check-deployment.py --env-file deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yaml -f "$RELEASE_MANIFEST" up -d --no-build --pull never --wait
sudo python3 scripts/check-health.py --env-file deploy/.env
```

Install frontend dependencies and Playwright Chromium before the deployment test.
It runs the real built stack with a **synthetic HTTPS OIDC issuer**, binds only
127.0.0.1:38443/39443, and removes its own containers/volumes afterward. Its
test-only certificates, identities, and issuer are not production credentials.
OIDC discovery must become healthy before SSO starts. Browser readiness requires
anonymous API rejection; only service-unavailable responses and refused/reset
connections are retried. Pre-login browser GETs retry `ERR_NETWORK_CHANGED` at
most twice. Authentication assertions, callbacks, POSTs, certificate errors,
timeouts, and other navigation failures are never retried.
The test's Debian/OpenSSL issuer image is never part of the deployable stack.

Trivy gates **all five deployable images** on high/critical findings, including
unfixed advisories. Do not suppress this gate merely to ship. Rebuild after every
source/lock/image change and rescan. CI runs tests/audits/scans without publishing
private images or uploading browser traces. CI is only active after these changes
are committed/pushed; no repository visibility changes are needed.
CI consumes GitHub Actions minutes; review your plan/quota before enabling the
weekly schedule. No cloud deployment is performed by this workflow.
Image builds and scans are attempted even if an earlier verification step fails;
the job still fails and cannot qualify for release.

The runtime/API uses Alpine rather than the initially evaluated Debian base.
Caddy and OAuth2 Proxy are built from exact upstream release commits with pinned
Go 1.27.2 and the x/net security update. Alpine security packages are upgraded at
image build time. This intentionally picks up OS fixes; save the tested release
image digests in your private registry rather than assuming later rebuilds are
byte-identical. See the Dockerfiles for pinned sources and required updates.

### Release gate and rollback

The current GitHub plan does not support branch protection for this private
repository. Keep it private; do not treat a successful push as a release approval.
If the plan later supports it, require the `verify` status on `main` and restrict
direct pushes. The local release gate does not prevent a GitHub administrator or
host operator from bypassing these instructions.

Stop on any failing gate; do not continue with an older or partial manifest.
`scripts/check-release.py` requires a clean committed tree and authenticated
GitHub CLI access. It checks that the repository is private and the newest
default-branch verification for the exact commit is green, including every
required test/deployment/scan step. It then rebuilds all five local images, runs
the synthetic SSO checks, scans those images, and rechecks source/image/CI state.
It creates a mode-0600 manifest outside the repository and never overwrites one.
This deliberately repeats local checks: hosted CI does not prove that later
rebuilds have the same contents. The GitHub CLI token is used only by local
tooling, never by the application, model, or containers.

The manifest is also a Compose override that pins the tested **local image
content IDs**, not movable tags. Always use `--no-build --pull never` with it.
Local content IDs are not registry manifest digests. If distributing images,
use a private registry, record the registry digests separately, and verify the
downloaded image contents. Manifests are unsigned operator records, not attested
build provenance; keep them in trusted private storage.

Retain the previous manifest, matching source/configuration, tested images, and
encrypted secret/TLS backups. Do not prune those images until rollback is no
longer required. To roll back, review and rescan the previous images, return to
their reviewed source/configuration without discarding unrelated work, and run
the same Compose command with the previous manifest and `--force-recreate`.
Never roll back to a release with known high/critical advisories or incompatible
secrets/provider configuration. Then rerun preflight, health checks, and invited
login/logout checks. Restarting the API clears its in-memory captures and rate
counters; recreating Redis invalidates SSO sessions.

### Read-only monitoring

`scripts/check-health.py` inspects only the five Beacon containers and makes
an anonymous, certificate-verified HTTPS request. It exits nonzero for stopped,
unhealthy, or OOM-killed containers, three or more container restarts, memory
use at or above 85 percent, certificates expiring within 14 days, or failure to
reject anonymous API access with a non-cacheable 401. It does not follow
redirects, sign in, read response bodies, or upload telemetry. Output contains
only fixed service names and operator messages, not config values or raw errors.
SSO/edge liveness is checked through running state and HTTPS; this is not an
authenticated provider-refresh or MFA test.

Have the chosen host's existing scheduler run it every five minutes and send
nonzero exits to the assigned operator through a private notifier. Scheduler,
notification channel, host-memory/disk/firewall monitoring, and expected-load
thresholds require host-specific setup; none are installed automatically. Docker
inspection requires trusted host privileges. Do not mount its socket in the app
or expose a public monitoring endpoint. Review aggregate status codes from the
already-redacted API logs if needed, never request bodies or auth cookies.

### Launch checklist

- [ ] All tests/audits/image scans pass on the release commit.
- [ ] The real provider successfully signs in an invited MFA-protected account.
- [ ] Uninvited/unverified accounts fail; forged headers cannot bypass sign-in.
- [ ] HTTPS certificate is valid and HTTP redirects, with no insecure bypasses.
- [ ] Anonymous `/api/*` requests fail, backend/session ports are unreachable.
- [ ] Logout invalidates the server-side session, including a copied old cookie.
- [ ] Provider refresh, expiration, account revocation, and allowlist removal tested.
- [ ] Expected load tested on the chosen host, monitoring and an operator assigned.
- [ ] Secret ownership, host updates, firewall, certificate storage, and recovery reviewed.
- [ ] Exact-commit release manifest retained and tested image identities deployed without rebuilding.
- [ ] Private notifications tested and previous-release recovery rehearsed.

Record each real-provider acceptance check in a private operator record with
date, release commit, pass/fail, and owner. Do not include emails, cookies,
tokens, client secrets, or document contents. For refresh/revocation, test before
and after the five-minute refresh boundary and the one-hour session expiry.
Record the actual provider revocation delay; do not assume immediate revocation.
Uninvited/unverified accounts, forged headers, and copied-cookie logout must
remain rejected. The synthetic suite does not fill out this acceptance record.

The API intentionally uses one worker and one replica. Request limits and
idempotency are process-local, not a distributed service. Do not scale replicas
without moving those controls to a shared authenticated store. Uvicorn limits
concurrency; the gateway/API bound request size, timeouts, and request rates.
New simulations share a 30/minute limit. Production API requests are additionally
limited to 120/minute per invited user and 600/minute globally. A host restart
resets these counters; this is not a DDoS defense. Use appropriate edge controls
and provider login throttling for your hosting environment.

## Data and sessions

Only use synthetic documents. A credential-pattern guard catches common AWS,
GitHub, private-key, JWT, and embedded-password patterns, but **cannot detect all
credentials, PII, business secrets, or deliberate obfuscation**. Browser drafts,
results, and imported replays are memory-only. Exports deliberately include inputs
and answers and are the user's responsibility. Clearing an API capture removes
the browser result and requests deletion of that user's API retry cache; clearing
an imported replay affects only the browser. Neither can delete saved exports
or another open tab. Close all tabs on shared devices.

API retry captures are isolated by authenticated user, bounded globally to 20,
and expire after 5 minutes (idle cleanup every 30 seconds). There is no lab
database, disk persistence, telemetry service, analytics, or external model.
Redis stores encrypted SSO sessions only, has password authentication, a dedicated
internal network, memory limits, no snapshots/AOF/volume, and a one-hour session
TTL. Browser SSO cookies are opaque tickets, Secure, HttpOnly, host-only, and
SameSite=Lax. Tokens stay server-side. Logout deletes the Redis session; provider
logout/revocation is separate and must be tested with your chosen provider.

For urgent access revocation, remove an address from `allowed_emails` and recreate
SSO and API so both layers reload it. Stop the site immediately for suspected
compromise. Rotate affected secrets, restart dependent services, and revoke
provider sessions/client credentials. Rotating SSO keys or recreating Redis
invalidates sessions. Do not silently regenerate keys at startup.

Logs intentionally omit emails, cookies, tokens, query strings, document contents,
and raw exceptions. API security events contain only server-generated request IDs
and status codes. Auth/gateway access logs are disabled. Monitor container health,
restarts, response status counts, certificate renewal, and available memory;
never expose monitoring publicly or collect request bodies for debugging.

Keep encrypted backups of deployment secrets and Caddy certificate volumes only,
not lab inputs or Redis data. To stop the site, use `docker compose --env-file
deploy/.env -f deploy/compose.yaml down`. Retain TLS volumes for later restarts.
Use private registries if distributing images, and never switch this repo public
to obtain CI or hosting features.
