# Verification: Beacon v0.2

No AWS credentials were used, no AWS resources were deployed, and no model
inference was invoked. Private-deployment checks used temporary local containers
and synthetic OIDC identities, not a real production provider or public site.

## Checks

| Check | Result |
| --- | --- |
| Python API/engine/CLI/security/release/monitor tests (`.venv/bin/python -m pytest`) | 134 passed |
| React/schema/hook/API/theme/browser-engine tests (`npm run test`) | 116 passed |
| Bounded deployment readiness/navigation regressions (`node --test tests/deployment/navigation.test.mjs`) | 15 passed |
| API browser tests (`npm run test:e2e`) | 56 passed across desktop/mobile |
| Static showcase browser tests (`npm run test:e2e:demo`) | 14 passed across desktop/mobile |
| TypeScript check and both production builds (`npm run build`, `npm run build:demo`) | Passed |
| Python/browser parity (`scripts/check-browser-parity.py --check`) | 34 fixture cases current; included in the frontend test count |
| Automated axe WCAG checks | No violations in tested main views, open options, captured results, inspection, and all walkthrough steps; both themes covered at 320px |
| Viewport overflow | None at 1440px, 390px, and 320px |
| Local Vite-to-FastAPI proxy | Health endpoint returned cloud/inference disabled |
| npm dependency audit (`npm audit --audit-level=high`) | No known dependency vulnerabilities reported |
| Pinned Python runtime audit (`pip-audit -r requirements.lock --require-hashes --disable-pip`) | No known vulnerabilities reported |
| Git history, working-tree, and public-build credential scans (Gitleaks, redacted output) | No leaks reported |
| All five deployable image scans (`python3 scripts/scan-images.py`) | Zero reported high/critical advisories, none suppressed |
| Private HTTPS/SSO stack (`scripts/test-deployment.py`) | Passed with synthetic HTTPS OIDC issuer |
| Same-engine CLI | Injected scenario produces EXPOSED / DENIED_BY_APP |

Automated accessibility checks are not a full manual accessibility audit.
The Python test run currently emits a third-party Starlette/httpx deprecation
warning; all API tests pass. Initial JavaScript is approximately 443 kB
(140 kB gzip). The API client, browser engine, validation engine, and graph load
separately when needed. The public demo does not load the API client.
The build no longer emits the large-chunk advisory. These sizes are build
measurements, not real-host latency or Core Web Vitals results.

## Public showcase verification

The static suite serves the built browser-demo assets with the Pages security
headers and no API. Desktop/mobile checks cover the walkthrough, each outcome,
edits, graph inspection, replay, exports, unverified imports, themes, keyboard
access, reduced motion, overflow, and automated accessibility checks. No backend
requests, browser errors, or CSP violations were observed.

React Bits and IBM Plex licenses are included in both build modes. Tests compare
the served notices with the original files. Source maps are disabled, and browser
execution is selected only by build configuration. Eight hook regressions cover
execution errors and interruption without silently switching between API and
browser engines.

The public URL has not been deployed or tested. See [public-demo.md](public-demo.md)
for Pages setup and deployed-URL acceptance; the repository can remain private.

## Private deployment/security verification

335 Python/frontend/browser/navigation tests pass, in addition to the container SSO smoke
checks. Private API hosting requires independent private-file gateway/CSRF keys, a fixed
HTTPS origin, and an explicit user allowlist; partial/invalid configuration fails
closed. Tests cover authentication before body parsing, strict origin and fetch
metadata checks, expiring/tampered/user-bound tokens, separate user caches,
per-user deletion, idle expiry, concurrency/backpressure, bounded chunked bodies,
body timeouts, request throttling, duplicate/oversized headers, and redacted
validation/exception/log output. Common credential patterns are rejected in the
browser/API, without claiming complete detection of secrets or PII.

The real built Caddy/OAuth2 Proxy/gateway/API/Redis stack was exercised on
loopback with generated test certificates and signed synthetic OIDC tokens.
Checks cover invited login, rejected uninvited/unverified/invalid-nonce/invalid-
signature identities, PKCE, spoofed identity headers, opaque Secure/HttpOnly
cookies, user-bound CSRF, cache isolation, logout and copied-cookie revocation,
private ports/networks, read-only/non-root/capability-free containers, strict
script CSP, disabled production API docs, generic failures, and mobile layout.
Container logs contain neither generated secrets, test email addresses, nor the
private-input test marker. The fixture stack and its volumes are removed after
testing. The preflight and key generator also have regression tests.

CI attempts image builds/scans even after earlier checks fail. A failed or
skipped required step still blocks release. Authentication, callback, mutation,
certificate, and timeout assertions are not retried.

The built HTTPS/SSO browser checks also confirm that initial page loading does
not fetch the validation chunk, a run does fetch it, and aborting that chunk
produces an error without submitting a simulation or inventing a result.
Existing browser workflows, replay/hash/credential guards, and accessibility
checks remain passing.

Release/monitor regressions require private exact-commit green CI with every
security step passed, reject dirty/changed source or image identities, preserve
existing mode-0600 manifests, and omit configuration/exception contents from
operator output. Host-health tests use mocked TLS/container measurements, not a
real production host. The manifest pins tested local image content IDs for
`--no-build --pull never`; it is unsigned and is not a registry digest or build
attestation. Real-host scheduling/notifications and rollback rehearsal remain
operator acceptance work. Branch protection is unavailable on the current
GitHub plan for this private repository, so the release gate is a documented
operator control, not server-side enforcement.

Image scans have no suppressed findings. Low/medium findings and newly published
advisories still require review. Version/hash locks and CI do not guarantee security.

Real-provider MFA, DNS/public TLS, revocation/refresh behavior, host-specific
load/monitoring, firewall/secret permissions, and operational recovery still
require the [deployment launch checklist](deployment.md). CI is configured for
pushes and pull requests; no production deployment has been performed. GitHub
remains private.

## Verified interactions

- Walkthrough examples replace drafts without running them or changing captures.
  Closing restores focus; exiting steps cannot receive keyboard focus.
- Theme preferences persist, synchronize between tabs, follow device changes,
  and tolerate denied storage. Theme loading keeps the strict script policy.
- Direct links, Back/Forward, page titles, draft preservation, and mobile focus
  containment work. Keyboard navigation stays scoped to the active control.
- Attraction/repulsion moves only button contents, by at most five pixels.
  Touch and reduced motion remain static. Spark animation stops after each burst.
- Document and future AWS previews never execute tools or claim run evidence.
- Clean/ignored attacks do not claim permission enforcement. Retrieval, context
  delivery, denial, and final disclosure remain distinct; role contexts are isolated.
- Draft edits preserve original captures. Inspection filters, playback, keyboard
  graph selection, and node layout do not trigger another run.
- Imports perform no execution and remain source-unverified. Unknown/cloud claims,
  inconsistent traces, changed hashes, credential patterns, and oversized inputs
  are rejected; document HTML stays inert.

These checks establish local application and synthetic-issuer deployment
behavior only. There has been no real LLM evaluation, AWS IAM/S3 validation,
CloudTrail capture, real-provider/hosted operational acceptance, cloud-cost test,
or independent penetration test. Saved screenshots are simulations, not cloud
security evidence.
