# Implementation status

## Step 1 — Update architecture

- [x] React/Vite frontend scaffold and Python/FastAPI local API.
- [x] No credentials in browser code; no cloud integrations enabled.
- [x] Fixed planned target identifiers, health/capability endpoints, local host/CORS rules.
- [x] Explicit cloud/mode availability and documented future security boundary.

## Step 2 — Visual direction

- [x] Light steel-blue workbench with shared-to-split architecture.
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

## Deferred deliberately — requires cloud approval

- [ ] Real AWS resources, execution roles, Bedrock calls, and permission tests.
- [ ] Cloud deployment, authentication, cost controls, and cleanup.
- [ ] Real S3/CloudTrail evidence and authenticated live AWS replay records.

Local simulation outcomes do not prove real LLM susceptibility or AWS IAM
enforcement. No AWS resources have been deployed and no inference costs have
been incurred. The project directory remains `ai-cloud-security-lab`; the app
and importable Python package are now Beacon (`beacon`).
