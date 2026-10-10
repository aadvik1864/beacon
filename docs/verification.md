# Local verification — Beacon v0.2

No AWS credentials were used, no resources were deployed, and no model inference
was invoked during implementation or validation.

## Checks

| Check | Result |
| --- | --- |
| Python API/engine/CLI tests (`.venv/bin/python -m pytest`) | 40 passed |
| React/schema/hook tests (`npm run test`) | 25 passed |
| Browser tests (`npm run test:e2e`) | 26 passed across desktop/mobile |
| TypeScript check and production build (`npm run build`) | Passed |
| Automated axe WCAG checks | No violations in tested main views, captured results, and setup guide |
| Viewport overflow | None at 1440px, 390px, and 320px |
| Local Vite-to-FastAPI proxy | Health endpoint returned cloud/inference disabled |
| npm dependency audit (`npm audit --omit=dev`) | No known production dependency vulnerabilities reported |
| Same-engine CLI | Injected scenario produces EXPOSED / DENIED_BY_APP |

Automated accessibility checks are not a full manual accessibility audit.
The Python test run currently emits a third-party Starlette/httpx deprecation
warning; all API tests pass. The build has a non-blocking chunk-size advisory
for its roughly 524 KiB main JavaScript bundle; the graph is loaded separately.

## Verified interactions

- Architecture node selection updates the explanation, without executing tools.
- Role selection inspects planned scope, without changing execution identities.
- Read-only document previews expand, collapse, and switch.
- React Bits component states are explicitly local visual previews.
- AnimatedList keyboard handling is scoped; Tab is not intercepted globally.
- The guide supports navigation and Escape dismissal, including React StrictMode.
- Hidden mobile navigation is inert; open navigation supports Escape and focus return.
- System and explicit reduced-motion preferences are respected.
- The interface remains usable without a local API connection.
- Real local API calls capture paired outcomes; no frontend-fabricated replacement
  is used when the API fails.
- Clean/ignored attacks show Not triggered rather than claiming a permission denial.
- Retrieval without disclosure is distinguished from both denial and exposure.
- Protected context never reuses payroll from a previous vulnerable run.
- Session protection, foreign-origin rejection, UTF-8 input bounds, body limits,
  fixed tool identifiers, rate limiting, and idempotency are tested.
- Draft changes leave existing results attached to their original snapshot.
- Visible graph nodes update with replay and open the correct inspection text.
- Replay filters and playback controls use captured events, not new execution.
- Exported JSON matches the API capture. Valid imports perform no execution;
  exported replay reports preserve the unverified-authenticity warning.
- Unknown/cloud claims, malformed traces, contradictory measurements, changed
  document hashes, oversized inputs, and active HTML are rejected or kept inert.

Screenshots were reviewed locally at 1440px and 390px; overflow/error checks also
covered 320px. Visual inspection caught and corrected a controlled-node sizing
bug in the graph, and browser assertions now require visible nodes. Captured
result accessibility checks also caught and corrected tool-chip text contrast.

These checks establish local application behavior only. There has been no real
LLM evaluation, AWS IAM/S3 validation, CloudTrail capture, hosted authentication
review, or cloud-cost test. Saved screenshots are local simulations, not cloud
security evidence.
