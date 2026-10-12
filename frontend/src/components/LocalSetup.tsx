import { RefreshCw } from 'lucide-react';
import type { useApiHealth } from '../hooks/useApiHealth';
import PageHeading from './PageHeading';
import CopyButton from './CopyButton';
import SpotlightCard from './react-bits/SpotlightCard';
import MagneticButton from './react-bits/MagneticButton';
import { isBrowserDemo } from '../lib/executionMode';

const frontendCommand = 'cd frontend\nnpm ci\nnpm run dev';
const backendCommand = "python3 -m venv .venv\n.venv/bin/python -m pip install -e '.[dev]'\n.venv/bin/python -m uvicorn beacon.api:app --host 127.0.0.1 --port 8000";

export default function LocalSetup({ api, reduceMotion }: { api: ReturnType<typeof useApiHealth>; reduceMotion: boolean }) {
  return <>
    <PageHeading title="Run locally" description="Run the website and its small simulation service on your own computer. No cloud account is needed." />
    <p className="context-note">Runs on your machine. AWS and paid inference are disabled.</p>
    {isBrowserDemo ? <p className="context-note">This public demo already runs entirely in your browser. No connection or sign-in is needed. The optional commands below run the separate local API version.</p> : <section className="connection-panel"><div><h2>Simulation service</h2><p>{api.state === 'connected' ? `Connected (v${api.health?.version})` : api.state === 'checking' ? 'Checking connection...' : 'Not connected. Start the service using the commands below. On a hosted site, reload to check your sign-in.'}</p></div><MagneticButton className="button secondary" disabled={api.state === 'checking'} onClick={() => void api.refresh()}><RefreshCw size={15} className={api.state === 'checking' ? 'spin' : ''} />Check connection</MagneticButton></section>}
    <div className="setup-grid"><CommandPanel title="Website" subtitle="From the project folder, in terminal one" code={frontendCommand} address="http://localhost:5173" reduceMotion={reduceMotion} /><CommandPanel title="Simulation service" subtitle="From the project folder, in terminal two" code={backendCommand} address="http://127.0.0.1:8000/api/docs" reduceMotion={reduceMotion} /></div>
    <details className="scope-panel"><summary>What is available?</summary><div className="scope-columns"><div><h3>You can</h3><ul><li>Edit fictional documents and compare access</li><li>Explore and replay recorded steps</li><li>Save and open simulation reports</li></ul></div><div><h3>Not enabled</h3><ul><li>Real AWS resources or cloud permissions</li><li>Live AI model responses</li><li>Cloud uploads or paid inference</li></ul></div></div></details>
  </>;
}

function CommandPanel({ title, subtitle, code, address, reduceMotion }: { title: string; subtitle: string; code: string; address: string; reduceMotion: boolean }) {
  return <SpotlightCard className="command-panel" reduceMotion={reduceMotion}><div className="command-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><CopyButton text={code} label={`Copy ${title.toLowerCase()} startup command`} /></div><pre><code>{code}</code></pre><div className="command-address">{address}</div></SpotlightCard>;
}
