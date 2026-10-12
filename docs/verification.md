# Verification: Beacon v0.2

No AWS credentials were used, no AWS resources were deployed, and no model
inference was invoked. Private-deployment checks used temporary local containers
and synthetic OIDC identities, not a real production provider or public site.

## Checks

| Check | Result |
| --- | --- |
| Python API/engine/CLI/security/release/monitor tests (`.venv/bin/python -m pytest`) | 133 passed |
| React/schema/hook/API tests (`npm run test`) | 45 passed |
| Bounded deployment readiness/navigation regressions (`node --test tests/deployment/navigation.test.mjs`) | 15 passed |
| Browser tests (`npm run test:e2e`) | 36 passed across desktop/mobile |
| TypeScript check and production build (`npm run build`) | Passed |
| Automated axe WCAG checks | No violations in tested main views, open options, captured results, inspection, and setup guide |
| Viewport overflow | None at 1440px, 390px, and 320px |
| Local Vite-to-FastAPI proxy | Health endpoint returned cloud/inference disabled |
| npm dependency audit (`npm audit --audit-level=high`) | No known dependency vulnerabilities reported |
| Pinned Python runtime audit (`pip-audit -r requirements.lock --require-hashes --disable-pip`) | No known vulnerabilities reported |
| Git history and working-tree credential scans (Gitleaks, redacted output) | No leaks reported |
| All five deployable image scans (`python3 scripts/scan-images.py`) | Zero reported high/critical advisories, none suppressed |
| Private HTTPS/SSO stack (`scripts/test-deployment.py`) | Passed with synthetic HTTPS OIDC issuer |
| Same-engine CLI | Injected scenario produces EXPOSED / DENIED_BY_APP |

Automated accessibility checks are not a full manual accessibility audit.
The Python test run currently emits a third-party Starlette/httpx deprecation
warning; all API tests pass. Initial JavaScript is approximately 435 kB
(137 kB gzip), down from 529 kB (163 kB gzip). The approximately 94 kB strict
validation engine loads on the first run/import; the graph is loaded separately.
The build no longer emits the large-chunk advisory. These sizes are build
measurements, not real-host latency or Core Web Vitals results.

## Private deployment/security verification

229 Python/frontend/browser/navigation tests pass, in addition to the container SSO smoke
checks. Production requires independent private-file gateway/CSRF keys, a fixed
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

The first hosted verification failed on a pre-login Chromium
`ERR_NETWORK_CHANGED` after Docker networking started, despite passing backend
and frontend checks. The fixture now waits for healthy OIDC discovery and
anonymous API rejection, and retries only that read-only navigation error at
most twice. Authentication/callback/POST/certificate/timeout checks remain strict.
Fifteen isolated regression cases cover success, bounds, and fail-fast behavior.
CI attempts image builds/scans even after earlier verification failures, without
turning a failed verification into a release success.

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

The image gate caught real high/critical advisories in the initial Debian,
OAuth2 Proxy, Go, and Alpine dependencies. The deployable API uses a smaller
Alpine runtime, OS security packages are upgraded, and the SSO/edge binaries use
verified upstream release commits with patched Go/x/net. Upstream release tags
are preserved in Go build metadata to avoid misidentification as old-major
pseudo-versions. The final five images pass the high/critical gate; no findings
are ignored. Low/medium findings and newly published advisories still require
ongoing review. Version/hash locks and CI do not guarantee security.

Real-provider MFA, DNS/public TLS, revocation/refresh behavior, host-specific
load/monitoring, firewall/secret permissions, and operational recovery still
require the [deployment launch checklist](deployment.md). CI is configured for
pushes and pull requests; no production deployment has been performed. GitHub
remains private.

## Verified interactions

- Architecture node selection updates the explanation, without executing tools.
- npm/Python package names and the lockfile consistently use `beacon`; the
  browser, API documentation, health response, and CLI use Beacon branding.
- Role selection inspects planned scope, without changing execution identities.
- Read-only document previews expand, collapse, and switch.
- React Bits component states are explicitly local visual previews.
- AnimatedList keyboard handling is scoped; Tab is not intercepted globally.
- The guide supports navigation and Escape dismissal, including React StrictMode.
- Secondary navigation stays hidden until opened. Mobile navigation traps focus;
  both desktop and mobile support Escape and focus return.
- System and explicit reduced-motion preferences are respected.
- The permission preview changes document scope descriptions without executing
  tools, editing the policy draft, or presenting configured access as evidence.
- RubberSegment supports native clicks, scoped arrow/Home/End navigation, and
  an unselected state for custom document drafts.
- SpotlightCard responds to pointer/focus without adding focusable decoration;
  ClickSpark leaves native button activation intact.
- Real click bursts finish and clear; switching the system motion preference at
  runtime disables lighting, spring animation, and spark rendering.
- The interface remains usable without a local API connection.
- Real local API calls capture paired outcomes; no frontend-fabricated replacement
  is used when the API fails.
- Clean/ignored attacks show Not triggered rather than claiming a permission denial.
- Retrieval without disclosure is distinguished from both denial and exposure.
- Protected context never reuses payroll from a previous vulnerable run.
- Session protection, foreign-origin rejection, UTF-8 input bounds, body limits,
  fixed tool identifiers, rate limiting, and idempotency are tested.
- Draft changes leave existing results attached to their original snapshot.
- The default workspace has one empty state, collapsed options, and no empty
  graphs or evidence panels. Headings and default copy contain no long dashes.
- Access measurements open on demand; inspection tabs support arrow/Home/End
  navigation and retain event filters while switching views.
- Closing inspection pauses replay without making new API requests.
- Visible graph nodes update with replay and open the correct inspection text.
- Replay filters and playback controls use captured events, not new execution.
- Exported JSON matches the API capture. Valid imports perform no execution;
  exported replay reports preserve the unverified-authenticity warning.
- Unknown/cloud claims, malformed traces, contradictory measurements, changed
  document hashes, oversized inputs, and active HTML are rejected or kept inert.

The React Bits playground was reviewed at 1440px, 390px, and 320px, with separate
preview/result screenshots. Overflow and axe checks also covered open options,
Architecture, Component bench, and Local setup at all three sizes. Browser
assertions require visible graph nodes. Earlier verification
corrected graph node sizing and tool-chip contrast; cleanup verification also
caught and corrected empty-state text contrast.

The normal-motion browser check exercises real canvas strokes and verifies that
the canvas clears after the click burst. It also switches the system preference
at runtime. That check caught a snapshot-only motion-hook behavior; the new
controls and app now use live media-query subscriptions rather than relying only
on the library's initial reduced-motion value.

The project was relocated to `/home/aadvik/beacon` without discarding working
changes. Virtual-environment activation/entry points and the editable Python
installation were repaired, npm metadata and the Vite dependency cache were
refreshed, and both local servers restarted successfully. The private GitHub
repository remains `aadvik1864/beacon`. Source/configuration and runtime metadata
checks found no previous project-name references; historical Git records and
saved diagnostic reports are not rewritten.

These checks establish local application and synthetic-issuer deployment
behavior only. There has been no real LLM evaluation, AWS IAM/S3 validation,
CloudTrail capture, real-provider/hosted operational acceptance, cloud-cost test,
or independent penetration test. Saved screenshots are simulations, not cloud
security evidence.
