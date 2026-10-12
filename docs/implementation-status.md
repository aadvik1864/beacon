# Implementation status

## Step 1 — Update architecture

- [x] React/Vite frontend scaffold and Python/FastAPI local API.
- [x] No credentials in browser code; no cloud integrations enabled.
- [x] Fixed planned target identifiers, health/capability endpoints, local host/CORS rules.
- [x] Explicit cloud/mode availability and documented future security boundary.

## Step 2 — Visual direction

- [x] Porcelain/indigo workspace with iris controls and a shared-to-split access illustration.
- [x] Design tokens and locally served IBM Plex fonts.
- [x] Responsive layouts, status text/icons, visible focus, reduced motion.

## Step 3 — React Bits integration

- [x] Adapted TypeScript/Tailwind Stepper, AnimatedList, CallChip, and StatusMark.
- [x] Source revision, attribution, modification notes, and license retained.
- [x] Scoped keyboard navigation; no global Tab interception.
- [x] Explicit local component preview, not cloud results or audit events.

## Step 4 — Attack playground

- [x] Beacon branding, page title, icon, npm package, and Python package rename.
- [x] Editable local policy draft, attack/clean presets, simple line diff, and question composer.
- [x] UTF-8 byte limits and explicit paired/single-target execution controls.
- [x] Snapshotted inputs and stale-draft labeling; no S3 uploads.

## Local comparison and evidence extensions

- [x] Same scripted fixture and inputs for both fixed local permission profiles.
- [x] Independent context per role/run and a unique synthetic exposure marker.
- [x] Separate request, retrieval, context delivery, and final-disclosure observations.
- [x] Not triggered, blocked locally, retrieved without disclosure, and exposed outcomes.
- [x] Bounded, session-protected API with rate limiting and idempotency.
- [x] React Flow access graph synchronized to captured events.
- [x] Filtered React Bits event list, scrubbing, step navigation, and playback.
- [x] JSON/Markdown exports and strict, hash-checked simulation replay import.
- [x] Same-engine local CLI for tests and maintenance.

## Interface cleanup

- [x] Compact header replaces the sidebar, breadcrumbs, and repeated status banners.
- [x] Plain page titles and copy without decorative slogans or long dashes.
- [x] Editor, question, run action, and answers remain visible; options and access details collapse.
- [x] Inspection uses on-demand Events/Access path tabs; exports and metadata open separately.
- [x] One empty state before execution; short simulation and imported-replay provenance retained.

## React Bits interaction polish

- [x] Adapted SpotlightCard, RubberSegment, and ClickSpark from the pinned upstream revision.
- [x] Interactive document-access preview of local scope, explicitly not run evidence.
- [x] Native spring selectors, cursor/focus lighting, click feedback, and captured-result reveal.
- [x] HiDPI/demand-only spark rendering; no continuous decorative background loop.
- [x] Keyboard equivalents, custom-template state, reduced motion, and retained attribution/license.

## Beginner-friendly redesign

- [x] Immediate plain-language introduction and a practical three-step walkthrough.
- [x] Interactive hidden-instruction example that prepares inputs without executing them.
- [x] Clear Too much access / Limited access labels and separate file-reading/disclosure results.
- [x] Persistent light/dark/device themes, cross-tab synchronization, and safe storage fallback.
- [x] Same-origin pre-paint theme bootstrap compatible with the private-hosted script policy.
- [x] Reusable, bounded MagneticButton attraction/repulsion with stationary hit areas.
- [x] Shared interactions across navigation, guides, documents, copying, exports, and replay.
- [x] Mobile and reduced-motion alternatives, modal focus return, inert exiting guide steps.
- [x] Direct links, browser history, page titles, and plain-language search metadata.
- [x] Existing planned AWS inspections preserved under an explicitly labeled collapsed section.

## Private-hosted simulation hardening

- [x] Fail-closed production settings, independent gateway/CSRF keys, and explicit SSO allowlist.
- [x] Trusted gateway verification, user-bound expiring tokens, strict origins, redacted errors/logs.
- [x] User-isolated retry captures, idle expiry, per-user deletion, bounded requests/rates/timeouts.
- [x] Common credential-pattern guards in browser/API, without claiming general DLP.
- [x] Private HTTPS/SSO containers, opaque cookies, encrypted server-side sessions, revoking logout.
- [x] Non-root/read-only containers, private networks, file secrets, locked runtime/build context.
- [x] Synthetic HTTPS OIDC/browser security checks, dependency audits, secret and image scan gates.
- [x] Bounded transient-navigation recovery, strict readiness, and scans attempted after verification failures.
- [x] Exact-commit private CI release gate, tested local image manifest, rollback guidance, read-only host checks.
- [x] On-demand strict frontend validation without accepting unvalidated submissions or captures.
- [ ] Real domain/provider/MFA setup and production launch checklist on the chosen host.
- [ ] Host scheduler/private alert integration, expected-load validation, and recovery rehearsal.

## Deferred deliberately — requires cloud approval

- [ ] Real AWS resources, execution roles, Bedrock calls, and permission tests.
- [ ] AWS cloud deployment, cloud cost controls, and cleanup.
- [ ] Real S3/CloudTrail evidence and authenticated live AWS replay records.

Local simulation outcomes do not prove real LLM susceptibility or AWS IAM
enforcement. No AWS resources have been deployed and no inference costs have
been incurred. The project directory, npm package, Python distribution, and
importable Python package are named `beacon`. The UI and API documentation use
Beacon as the display name.
