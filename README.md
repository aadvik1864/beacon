# Beacon

A local-first, interactive workbench for studying prompt injection and AWS
least privilege. Built with React, TypeScript, Vite, Tailwind, React Bits, and
a small Python/FastAPI backend.

## Implemented scope

Beacon **v0.2** includes the interface foundation and a complete local experiment flow:

- React application and session-protected local Python simulation API.
- Attack document editor, clean/attack presets, diff view, and question composer.
- Paired vulnerable/protected results with separately observed retrieval and disclosure.
- Interactive React Flow access graph, filtered event trace, and replay controls.
- Validated JSON replay import and JSON/Markdown report export.
- Adapted React Bits Stepper, AnimatedList, CallChip, and StatusMark components.
- Interactive role/document explanations, setup walkthrough, and component bench.
- Local simulation CLI, keyboard access, reduced motion, local fonts, and automated tests.

**The assistant is a deterministic scripted fixture, not an LLM. Permissions
are checked by a local mock document store, not AWS IAM.** There is no AWS
deployment, real model inference, S3 upload, or cloud audit evidence. No paid
inference is enabled, and no AWS credentials are needed.

## Run the frontend

Requires Node.js **22.22.2+ within Node 22 LTS**, Node 24.15+, or Node 26+.

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173** or **http://127.0.0.1:5173**. Editing and replay
import work without the Python API; new simulations require the API below.

## Run the local API

From the project root, in a separate terminal:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m uvicorn beacon.api:app --host 127.0.0.1 --port 8000
```

Vite proxies `/api` to this loopback address. API documentation is at
http://127.0.0.1:8000/api/docs. Read-only health/capability routes and a guarded
`POST /api/simulations` are available. No AWS SDK is installed.

For the exact Python dependency versions used during validation:

```bash
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install -e . --no-deps
```

The frontend dependency snapshot is `frontend/package-lock.json`.

## Try an experiment

1. Run **Run comparison** with the clean policy: both profiles show **Not triggered**.
2. Choose **Load attack example**, then **Run comparison**. The vulnerable profile
   exposes synthetic payroll; the protected profile shows **Blocked locally**.
3. Inspect the request, retrieval, context-delivery, and answer measurements.
   Scrub the recorded trace to update the access graph, or filter for denials.
4. Try **Ignore embedded instructions** or **Retrieve without disclosing**.
   A non-triggered attack is not proof of permission enforcement. Retrieval without
   disclosure still delivers restricted data to the scripted context.
5. Export JSON to retain a capture, or Markdown for a readable report. Imported
   JSON is always labeled **authenticity unverified**; a document hash does not
   authenticate the file or establish AWS evidence.

Edits are local drafts, never S3 uploads. Captures retain their original inputs
when a draft changes. Use synthetic content only; exports contain the captured
policy, question, and answers. Audit events omit raw document contents.

## Local CLI

The CLI runs the same engine without a browser, API server, or cloud access:

```bash
.venv/bin/python -m beacon --scenario injected
.venv/bin/python -m beacon --scenario injected --behavior retrieve_only
.venv/bin/python -m beacon --policy data/leave-policy-clean.txt --target protected
.venv/bin/python -m beacon --scenario injected --format json > beacon-simulation.json
```

The final command produces a simulation replay that the frontend can import.
Choose an unused output filename if you do not want shell redirection to replace it.

## Check the project

```bash
.venv/bin/python -m pytest
```

From `frontend/`:

```bash
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the frontend and API if needed. Its experiment tests call the
real **local simulation** API; no AWS service or real LLM is involved.

## Architecture and safety

Now: Browser → local API → scripted fixture + local permission profiles.

Later: Browser → local API → **future** fixed Lambda targets → **future** Bedrock/S3.
The future protected and vulnerable targets will use separate execution roles,
not a user-provided role ARN or a permission switch inside one function.

The current API binds to loopback, restricts hosts/origins, checks a process-local
session token, bounds request sizes, blocks overlapping simulations, and limits
new runs to 30/minute. Idempotency records are in memory, bounded to 20 entries,
and expire after 30 minutes. Clear capture removes the browser view, not the
short-lived API cache. Nothing is automatically persisted to disk.

**Do not expose this development API publicly.** The session token is a local
request-protection mechanism, not user authentication. AWS implementation needs
explicit approval, region/model selection, cost review, fixed isolated roles,
and a cleanup plan. Free-tier eligibility is not assumed.

See [architecture](docs/architecture.md), [design](docs/design.md),
[implementation status](docs/implementation-status.md), and
[React Bits attribution](frontend/THIRD_PARTY_NOTICES.md).
