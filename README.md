# Beacon

Beacon is an interactive lab that shows why an AI assistant should only read the
files it needs. Add a hidden instruction to a fictional document, then compare
what happens with different levels of access.

**Live:** [beacon-aadvik.vercel.app](https://beacon-aadvik.vercel.app)

Open it in your browser. No account, installation, or cloud setup is needed.

## What to try

1. Click **Walkthrough** to prepare an example.
2. Click **Run comparison** to see both answers.
3. Compare **Too much access** with **Limited access**. One can read the
   fictional payroll file; the other blocks it.
4. Open **Access details** or **Inspect run** to see which files were requested
   and follow the recorded steps.
5. Edit the document or question and try again.

You can also start with the original policy. Without a request for payroll,
both versions show **No private file requested**.

## What you can do

- Edit fictional documents and compare the results side by side.
- Explore the access graph and replay each step.
- Save reports and open them again later.
- Switch between light and dark themes.
- Use the demo on a phone or with a keyboard.

## About the demo

The answers are scripted simulations using fictional data. Beacon does not use
a live AI model or test real AWS permissions.

The public demo runs in your browser. Your edits are not uploaded, and only your
theme choice is saved between visits. Reports include the document, question,
and answers, so use fictional information only.

All sample files are public. The access limits illustrate a security idea; they
do not protect files from someone inspecting their own browser. Imported reports
are marked **source not verified**.

## Run it locally

Use Node.js 22.22.2+ on the Node 22 line, Node 24.15+, or Node 26+.

```bash
cd frontend
npm ci
npm run build:demo
npm run preview
```

Open **http://127.0.0.1:4173**. To see changes while editing the code, use
`npm run dev -- --mode demo`.

The website uses React and TypeScript. An optional Python service is available
for local development.

<details>
<summary>For developers: local service and checks</summary>

### Start the local service

The default build uses the Python service. If it fails, Beacon shows the error;
it does not quietly switch to browser simulation.

From the project root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m uvicorn beacon.api:app --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. API documentation is at
**http://127.0.0.1:8000/api/docs**.

For repeatable Python checks, install `requirements-dev.lock`, then install
the project with `pip install -e . --no-deps` in the virtual environment.

### Run from the command line

```bash
.venv/bin/python -m beacon --scenario injected
.venv/bin/python -m beacon --scenario injected --behavior retrieve_only
.venv/bin/python -m beacon --policy data/leave-policy-clean.txt --target protected
.venv/bin/python -m beacon --scenario injected --format json > beacon-simulation.json
```

The saved JSON report can be opened in either mode. Choose a new filename so you
do not overwrite an existing report.

### Check the project

From the project root:

```bash
.venv/bin/python -m pytest
.venv/bin/python scripts/check-browser-parity.py --check
node --test tests/deployment/navigation.test.mjs
```

From `frontend/`:

```bash
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:demo
```

The browser tests cover both the local service and the standalone demo. Run them
separately from Docker network setup to avoid temporary connection errors.

Keep the development API local. For private hosting, follow the
[private deployment guide](docs/deployment.md).

</details>

## More information

- [Publish the browser demo](docs/public-demo.md)
- [How Beacon works](docs/architecture.md)
- [Design notes](docs/design.md)
- [Tests and checks](docs/verification.md)
- [Third-party licenses](frontend/THIRD_PARTY_NOTICES.md)
