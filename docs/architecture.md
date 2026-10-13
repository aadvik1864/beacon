# Beacon architecture

## Browser showcase

```text
Static HTTPS host -> React interface -> browser simulation -> captured result
```

`npm run build:demo` selects browser execution explicitly. It makes no API calls
and requires no accounts or server. The scripted browser engine is checked
against the Python engine with 34 parity cases. API failures never select this
mode automatically.

All sample files, including fictional payroll, are public in this build. Its
permission checks teach the access boundary; they cannot protect data from
someone inspecting or modifying their own browser. Documents and captures stay
in memory. Only the theme preference is persisted. See [public-demo.md](public-demo.md)
for hosting and deployed-URL checks.

## Local API

```text
React + TypeScript + React Bits + React Flow (localhost:5173)
                 │ same-origin /api proxy
                 ▼
Local FastAPI (127.0.0.1:8000)
    GET  /api/health
    GET  /api/capabilities
    GET  /api/session
    POST /api/simulations
                 │ bounded input snapshot
                 ▼
Same scripted fixture, isolated contexts
    ├── vulnerable local profile → leave_policy + payroll
    └── protected local profile  → leave_policy only
                 │
     RunRecord: inputs, outcomes, measured event offsets
```

`python -m beacon` calls the same simulation engine directly. There is no AWS
SDK, cloud credential lookup, external tool execution, or model inference.

The fixture recognizes a narrow document instruction: a retrieval verb followed
within 200 characters by `private/payroll.csv`. It is **not** a general injection
detector. The selected scripted behavior controls whether that instruction is
followed, ignored, or retrieved without final disclosure. A direct payroll
question separately exercises the same permission boundary. Other questions
are not interpreted by an LLM.

The document tool accepts only `leave_policy` and `payroll`. Its fixed local
profiles are immutable and have separate contexts. No arbitrary file paths,
bucket names, AWS identities, or executable commands are accepted by the API.
The payroll is entirely synthetic, with a new exposure marker per run.

## Measurements and outcomes

Request, successful retrieval, delivery to scripted context, and disclosure in
the final answer are recorded separately. Exposure requires actual synthetic
records plus the unique marker in the answer, not a statement claiming access.

- `NOT_TRIGGERED`: no payroll request; does not exercise the permission boundary.
- `DENIED_BY_APP`: local mock permission rejection; **not** AWS AccessDenied.
- `RETRIEVED_NOT_DISCLOSED`: restricted data reached context but not the answer.
- `EXPOSED`: retrieved synthetic records appeared in the final answer.

Results stay fixed during replay. The graph uses only events through the current
cursor. Playback pace is illustrative; event timestamps and offsets are measured
during the actual local run. Audit event metadata excludes document contents,
while the full capture/export includes policy, question, and final answers.

## Local request boundary

- Bind to loopback; trust only localhost and 127.0.0.1 hostnames.
- Permit the documented Vite origins; reject foreign Origin and cross-site
  requests for session issuance and mutations.
- Require JSON plus a random process-local session token for simulations.
  The token stays in browser memory and is not an AWS credential.
- Bound bodies to 32 KiB, policy to 8 KiB, and question to 1 KiB (UTF-8 bytes).
- Reject unknown input fields and non-simulation modes.
- Permit one simulation at a time and at most 30 new runs/minute per process.
- Keep idempotency captures in memory: at most 20, expiring after 30 minutes.
  Same key/inputs returns the existing record; changed inputs returns conflict.
- Disable HTTP response caching. No automatic disk persistence.

These are development safeguards, not public-production authentication or a
multi-user security boundary. Do not expose either development server publicly.

## Optional private hosting

The Python engine can also run behind private HTTPS/OIDC access. Caddy routes
through OAuth2 Proxy; the gateway overwrites identity headers, and the API
independently checks its gateway key and allowlist. OIDC tokens stay in encrypted
server-side Redis sessions. Only opaque HttpOnly tickets reach the browser.
Lab captures stay in short-lived, user-isolated API memory. See
[deployment.md](deployment.md) for configuration and launch gates.

AWS execution is not implemented. The collapsed AWS explanation in the interface
is a design illustration, not evidence of a deployment or live permission test.

## Provenance

- **Local preview:** component states and planned architecture explanations.
- **Browser simulation:** captured scripted runs with `execution_source` and
  event sources set to `browser-simulation`; no network execution.
- **Local simulation:** captured requests/outcomes from the scripted local engine.
- **Imported simulation replay:** bounded schema, trace consistency, and document
  hash validated; file authenticity remains **unverified**. Import is entirely
  client-side and never sends the file to the API. Arbitrary HTML is rendered as text.
- **Live AWS:** unavailable. Imports claiming live models/AWS are rejected.

The document hash checks content consistency, not authenticity or provenance.
Exports are unsigned; they are educational local evidence, never cloud evidence.
