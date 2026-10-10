import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Box, Braces, Check,
  ChevronDown, ChevronRight, CloudOff, Code2, FileText, FlaskConical,
  Layers3, LockKeyhole, Menu, MessageSquare, Network, RefreshCw,
  RadioTower, Settings2, Shield, ShieldAlert, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { useApiHealth } from './hooks/useApiHealth';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useExperiment } from './hooks/useExperiment';
import PageHeading from './components/PageHeading';
import Playground from './components/experiment/Playground';
import CopyButton from './components/CopyButton';
import SetupGuide from './components/SetupGuide';
import Stepper, { Step } from './components/react-bits/Stepper';
import AnimatedList from './components/react-bits/AnimatedList';
import CallChip, { type CallChipStatus } from './components/react-bits/CallChip';
import StatusMark, { type StatusMarkStatus } from './components/react-bits/StatusMark';

type Page = 'playground' | 'workbench' | 'components' | 'setup';
type Role = 'vulnerable' | 'protected';
type ArchitectureNode = 'question' | 'model' | 'backend';
const pageNames: Record<Page, string> = { playground: 'Attack playground', workbench: 'Architecture', components: 'Component bench', setup: 'Local setup' };
const navigation = [
  { id: 'playground' as const, icon: FlaskConical, label: 'Playground', description: 'Run a local experiment' },
  { id: 'workbench' as const, icon: Network, label: 'Architecture', description: 'Explore the boundary' },
  { id: 'components' as const, icon: Layers3, label: 'Component bench', description: 'Try the interface' },
  { id: 'setup' as const, icon: Settings2, label: 'Local setup', description: 'Connect the local API' },
];

export default function App() {
  const [page, setPage] = useState<Page>('playground');
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const mobile = useMediaQuery('(max-width: 800px)');
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeNavButton = useRef<HTMLButtonElement>(null);
  const api = useApiHealth();
  const experiment = useExperiment();

  useEffect(() => {
    if (!mobile || !mobileNavOpen) return;
    closeNavButton.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('keydown', dismiss);
      menuButton.current?.focus();
    };
  }, [mobile, mobileNavOpen]);

  function navigate(next: Page) {
    setPage(next);
    setMobileNavOpen(false);
  }

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="app-shell" data-reduced-motion={reduceMotion ? 'true' : undefined}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <aside className="sidebar" data-open={mobileNavOpen} aria-label="Lab navigation" inert={mobile && !mobileNavOpen} aria-hidden={mobile && !mobileNavOpen ? true : undefined} role={mobile && mobileNavOpen ? 'dialog' : undefined} aria-modal={mobile && mobileNavOpen ? true : undefined}>
          <a className="brand" href="#main-content" onClick={() => navigate('playground')} aria-label="Beacon home">
            <span className="brand-symbol"><RadioTower size={23} strokeWidth={1.7} /></span>
            <span>Beacon<span className="brand-subtitle">AI security workbench</span></span>
          </a>
          <button ref={closeNavButton} className="icon-button mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={20} /></button>
          <div className="sidebar-project"><span className="project-dot" />Prompt injection / AWS</div>
          <nav className="main-nav">
            {navigation.map(({ id, icon: Icon, label, description }) => (
              <button key={id} className="nav-item" data-active={page === id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}<small>{description}</small></span>
                {page === id && <span className="nav-active-mark" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="note-icon"><LockKeyhole size={18} /></span>
            <h3>Permissions, not promises.</h3>
            <p>The security boundary belongs outside the model.</p>
            <button onClick={() => setGuideOpen(true)}>Understand the lab <ArrowRight size={14} /></button>
          </div>
          <div className="sidebar-bottom">
            <span className="local-dot" /> Local simulation
            <small>AWS and inference disabled</small>
          </div>
        </aside>
        {mobileNavOpen && <button className="nav-scrim" aria-label="Dismiss navigation" onClick={() => setMobileNavOpen(false)} />}
        <div className="main-shell" inert={mobile && mobileNavOpen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
              <span className="breadcrumb-root">Lab workspace</span><ChevronRight size={14} /><span>{pageNames[page]}</span>
            </div>
            <div className="topbar-actions">
              <button className="motion-control" aria-label={reduceMotion ? 'Restore system motion preference' : 'Reduce motion'} aria-pressed={reduceMotion} onClick={() => setReduceMotion(!reduceMotion)} title="System reduced-motion preferences are always respected">
                <Sparkles size={15} /><span>{reduceMotion ? 'Motion reduced' : 'Reduce motion'}</span>
              </button>
              <span className="topbar-divider" />
              <button className="guide-trigger" onClick={() => setGuideOpen(true)}><BookOpen size={16} /><span>Quick guide</span></button>
            </div>
          </header>
          <main id="main-content" className="main-content" tabIndex={-1}>
            {page === 'playground' && <Playground experiment={experiment} reduceMotion={reduceMotion} />}
            {page === 'workbench' && <Workbench reduceMotion={reduceMotion} openGuide={() => setGuideOpen(true)} openComponents={() => navigate('components')} />}
            {page === 'components' && <ComponentBench reduceMotion={reduceMotion} />}
            {page === 'setup' && <LocalSetup api={api} />}
            <footer className="page-footer"><span><Shield size={13} /> Synthetic data only. No cloud activity.</span><span>Beacon · local simulation · v0.2</span></footer>
          </main>
        </div>
        {guideOpen && <SetupGuide reduceMotion={reduceMotion} onClose={() => setGuideOpen(false)} />}
      </div>
    </MotionConfig>
  );
}

function PreviewNotice({ children }: { children?: ReactNode }) {
  return <div className="preview-notice"><CloudOff size={18} /><p>{children ?? <>You’re exploring the interface. <strong>No model or AWS requests are running.</strong></>}</p><span className="notice-tag">Cloud disabled</span></div>;
}

const architectureDetails: Record<ArchitectureNode, { title: string; detail: string }> = {
  question: { title: 'A question starts the workflow.', detail: 'The future assistant will answer leave-policy questions. The same question will be used for both permission configurations.' },
  model: { title: 'The model proposes an action.', detail: 'Bedrock will return a structured tool request. The model will not hold AWS credentials or directly retrieve S3 objects.' },
  backend: { title: 'The backend executes the request.', detail: 'A fixed document identifier will map to a fixed S3 key. The function’s execution role—not the model—determines what AWS permits.' },
};

function Workbench({ reduceMotion, openGuide, openComponents }: { reduceMotion: boolean; openGuide: () => void; openComponents: () => void }) {
  const [node, setNode] = useState<ArchitectureNode>('backend');
  const [document, setDocument] = useState<'policy' | 'payroll'>('policy');
  const [role, setRole] = useState<Role>('protected');
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const nodeButtons = [
    { id: 'question' as const, label: 'User question', subtitle: 'One shared input', icon: MessageSquare },
    { id: 'model' as const, label: 'AI assistant', subtitle: 'Amazon Bedrock · planned', icon: Box },
    { id: 'backend' as const, label: 'Document tool', subtitle: 'Python / Lambda · planned', icon: Code2 },
  ];

  return (
    <>
      <PageHeading title={<>The model can ask.<br />Permissions decide.</>} description="Explore where an AI request ends and a cloud security boundary begins." action={<button className="button secondary" onClick={openGuide}><BookOpen size={16} /> Walk through the lab</button>} />
      <PreviewNotice />
      <section className="architecture-panel" aria-labelledby="architecture-title">
        <div className="panel-heading"><div><span className="panel-icon"><Network size={17} /></span><h2 id="architecture-title">One workflow. Two boundaries.</h2></div><span className="text-note">Select a step to inspect it</span></div>
        <div className="architecture-flow">
          <div className="shared-path">
            {nodeButtons.map(({ id, label, subtitle, icon: Icon }, index) => (
              <div className="flow-node-group" key={id}>
                {index > 0 && <ArrowRight className="flow-arrow" size={18} aria-hidden="true" />}
                <button className="flow-node" aria-pressed={node === id} onClick={() => setNode(id)}>
                  <span className="flow-node-icon"><Icon size={22} strokeWidth={1.5} /></span>
                  <strong>{label}</strong><small>{subtitle}</small>
                </button>
              </div>
            ))}
          </div>
          <svg className="branch-connector" viewBox="0 0 64 100" fill="none" aria-hidden="true"><path d="M0 50H22Q30 50 30 42V23Q30 15 38 15H64M30 50V77Q30 85 38 85H64" stroke="currentColor" strokeWidth="1.5" /><circle cx="30" cy="50" r="3" fill="currentColor" /></svg>
          <div className="role-branches">
            <button aria-pressed={role === 'vulnerable'} className="branch-button vulnerable" onClick={() => setRole('vulnerable')}><ShieldAlert size={19} /><span>Vulnerable role<small>Two document permissions</small></span><ChevronRight size={15} /></button>
            <button aria-pressed={role === 'protected'} className="branch-button protected" onClick={() => setRole('protected')}><ShieldCheck size={19} /><span>Protected role<small>Policy permission only</small></span><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="architecture-explanation" aria-live="polite"><span className="explanation-rule" /><div><strong>{architectureDetails[node].title}</strong><p>{architectureDetails[node].detail}</p></div><span className="planned-label">Planned architecture</span></div>
      </section>
      <div className="workbench-grid">
        <section className="documents-panel" aria-labelledby="documents-title">
          <div className="panel-heading"><div><span className="panel-icon"><FileText size={17} /></span><h2 id="documents-title">The documents</h2></div><span className="tiny-label">Read-only preview</span></div>
          <div className="document-selector" role="group" aria-label="Document previews">
            <button aria-pressed={document === 'policy'} onClick={() => { setDocument('policy'); setPreviewExpanded(true); }}><FileText size={18} /><span>Leave policy<small>Allowed in both configurations</small></span><ChevronRight size={15} /></button>
            <button aria-pressed={document === 'payroll'} onClick={() => { setDocument('payroll'); setPreviewExpanded(true); }}><LockKeyhole size={18} /><span>Synthetic payroll<small>Restricted in protected configuration</small></span><ChevronRight size={15} /></button>
          </div>
          <div className="document-preview">
            <button className="document-preview-header" aria-expanded={previewExpanded} aria-controls="document-preview-content" onClick={() => setPreviewExpanded(!previewExpanded)}><code>{document === 'policy' ? 'policies/leave-policy.txt' : 'private/payroll.csv'}</code><ChevronDown size={15} data-open={previewExpanded} /></button>
            {previewExpanded && <div id="document-preview-content" className="document-preview-content">
              {document === 'policy' ? <><span className="code-comment"># Layout preview — not an uploaded file</span><p>Employees receive 20 days of annual leave.</p><p>Leave requests require manager approval.</p><div className="injection-placeholder"><Braces size={16} /><span>Edit an attack document in the Playground.</span></div></> : <><span className="code-comment"># Synthetic fixture description</span><p>A small CSV containing fictional employee IDs, payroll values, and a unique exposure marker.</p><div className="injection-placeholder"><LockKeyhole size={16} /><span>No real employee information.</span></div></>}
            </div>}
          </div>
          <p className="panel-footnote">Document previews are explanatory UI content. Nothing has been uploaded to S3.</p>
        </section>
        <section className="permissions-panel" aria-labelledby="permissions-title">
          <div className="panel-heading"><div><span className="panel-icon"><LockKeyhole size={17} /></span><h2 id="permissions-title">Compare the permissions</h2></div><span className="tiny-label">Not provisioned</span></div>
          <div className="permission-lanes">
            <PermissionLane role="vulnerable" selected={role === 'vulnerable'} onSelect={() => setRole('vulnerable')} reduceMotion={reduceMotion} />
            <PermissionLane role="protected" selected={role === 'protected'} onSelect={() => setRole('protected')} reduceMotion={reduceMotion} />
          </div>
          <div className="role-inspector" aria-live="polite"><span className="inspection-label">Selected boundary</span><strong>{role === 'protected' ? 'Protected lab role' : 'Vulnerable lab role'}</strong><p>{role === 'protected' ? 'Intended scope: read the policy only. A payroll request must be denied by AWS in the future live test.' : 'Intended scope: read exactly the two synthetic lab objects. No IAM changes, other buckets, or role assumption.'}</p></div>
        </section>
      </div>
      <section className="next-step-panel"><div><span className="next-step-icon"><Layers3 size={21} /></span><div><h2>The interaction layer is ready to explore.</h2><p>Try the React Bits components without starting a cloud experiment.</p></div></div><button className="button secondary" onClick={openComponents}>Open component bench <ArrowRight size={16} /></button></section>
    </>
  );
}

function PermissionLane({ role, selected, onSelect, reduceMotion }: { role: Role; selected: boolean; onSelect: () => void; reduceMotion: boolean }) {
  const protectedRole = role === 'protected';
  const Icon = protectedRole ? ShieldCheck : ShieldAlert;
  return (
    <article className={`permission-lane ${role}`} data-selected={selected}>
      <button className="lane-heading" aria-pressed={selected} aria-label={`Inspect ${role} permissions`} onClick={onSelect}><Icon size={21} /><span>{protectedRole ? 'Protected' : 'Vulnerable'}<small>Separate execution role</small></span><span className="lane-selected-dot" /></button>
      <div className="permission-row"><FileText size={15} /><span>Leave policy</span><span className="permission-status allowed"><Check size={12} /> Allowed*</span></div>
      <div className="permission-row"><LockKeyhole size={15} /><span>Payroll</span><span className={`permission-status ${protectedRole ? 'restricted' : 'allowed'}`}>{protectedRole ? <LockKeyhole size={12} /> : <Check size={12} />}{protectedRole ? 'Restricted*' : 'Allowed*'}</span></div>
      <p className="planned-permission-note">* Planned permissions, not observed results.</p>
      <div className="lane-tool"><CallChip status="idle" argument="leave_policy" reduceMotion={reduceMotion} /><span>No request sent</span></div>
      <div className="lane-readiness"><StatusMark status="pending" size={17} label="Awaiting implementation" reduceMotion={reduceMotion} /></div>
    </article>
  );
}

const componentNames = ['Stepper', 'AnimatedList', 'CallChip', 'StatusMark'];
const componentDescriptions = [
  'A short, navigable walkthrough.', 'A selectable, keyboard-friendly list.', 'Feedback for a document tool request.', 'A compact, explicit operation state.',
];
const chipStates: CallChipStatus[] = ['idle', 'running', 'done', 'error'];
const markStates: StatusMarkStatus[] = ['pending', 'running', 'done', 'failed'];
const stateLabels = ['Queued', 'Running', 'Completed', 'Failed'];

function ComponentBench({ reduceMotion }: { reduceMotion: boolean }) {
  const [component, setComponent] = useState(2);
  const [previewState, setPreviewState] = useState(0);
  const [listSelection, setListSelection] = useState(0);
  const [walkthroughComplete, setWalkthroughComplete] = useState(false);
  const [stepperKey, setStepperKey] = useState(0);
  const source = component === 2
    ? `<CallChip\n  name="get_document"\n  argument="leave_policy"\n  status="${chipStates[previewState]}"\n/>`
    : component === 3
      ? `<StatusMark\n  status="${markStates[previewState]}"\n  label="Component preview"\n/>`
      : component === 1
        ? '<AnimatedList\n  items={items}\n  onItemSelect={handleSelect}\n/>'
        : '<Stepper labels={["Prepare", "Inspect", "Finish"]}>\n  <Step>...</Step>\n  <Step>...</Step>\n  <Step>...</Step>\n</Stepper>';

  return (
    <>
      <PageHeading title="The interface, under a microscope." description="Four React Bits components, adapted for this workbench. Try their behavior here." />
      <PreviewNotice>These controls change <strong>local visual states only.</strong> They do not run tools, contact AWS, or produce security evidence.</PreviewNotice>
      <div className="component-bench-grid">
        <section className="component-inventory" aria-labelledby="inventory-title">
          <div className="panel-heading"><div><Layers3 size={17} /><h2 id="inventory-title">Component library</h2></div></div>
          <AnimatedList items={componentNames} selectedIndex={component} onItemSelect={(_, index) => { setComponent(index); setPreviewState(0); }} label="React Bits components" reduceMotion={reduceMotion} renderItem={(item, index) => <><span className="component-option-icon">{index === 0 ? <Network size={18} /> : index === 1 ? <Layers3 size={18} /> : index === 2 ? <Code2 size={18} /> : <Activity size={18} />}</span><span><strong>{item}</strong><small>{componentDescriptions[index]}</small></span><ChevronRight size={15} /></>} />
          <div className="inventory-note"><span>Source, not a black box.</span><p>Selected TypeScript components are included locally, with attribution and license notices.</p><a href="https://reactbits.dev" target="_blank" rel="noreferrer">Explore React Bits <ArrowUpRight size={14} /></a></div>
        </section>
        <section className="component-preview-panel" aria-labelledby="component-title">
          <div className="panel-heading"><div><h2 id="component-title">{componentNames[component]}</h2><span className="component-preview-label">UI preview</span></div><span className="text-note">No cloud activity</span></div>
          <div className="component-preview-stage">
            {(component === 2 || component === 3) && <>
              <div className="preview-center">
                {component === 2 ? <CallChip status={chipStates[previewState]} reduceMotion={reduceMotion} onRetry={() => setPreviewState(0)} /> : <StatusMark status={markStates[previewState]} label="Component preview" size={28} reduceMotion={reduceMotion} />}
              </div>
              <div className="preview-state-controls" role="group" aria-label="Preview state">
                {stateLabels.map((label, index) => <button key={label} aria-pressed={previewState === index} onClick={() => setPreviewState(index)}>{label}</button>)}
              </div>
              <p className="preview-state-note">“{stateLabels[previewState]}” is a manually selected appearance—not a measured operation.</p>
            </>}
            {component === 1 && <div className="list-demo"><AnimatedList items={['Prepare the documents', 'Inspect the access boundary', 'Read the evidence']} selectedIndex={listSelection} onItemSelect={(_, index) => setListSelection(index)} reduceMotion={reduceMotion} label="Illustrative workflow items" /><p className="preview-state-note">Selected: {listSelection + 1}. Use ↑ / ↓, Home, and End. Tab leaves the list.</p></div>}
            {component === 0 && <div className="stepper-demo">
              {walkthroughComplete ? <div className="walkthrough-complete"><StatusMark status="done" label="Preview walkthrough completed" reduceMotion={reduceMotion} /><button className="button secondary small" onClick={() => { setWalkthroughComplete(false); setStepperKey(stepperKey + 1); }}>Restart preview <RefreshCw size={14} /></button></div> : <Stepper key={stepperKey} labels={['Prepare', 'Inspect', 'Finish']} reduceMotion={reduceMotion} onFinalStepCompleted={() => setWalkthroughComplete(true)}>
                <Step><h3>Prepare the experiment</h3><p>This walkthrough demonstrates navigation only. Use the Playground to edit documents and run a local scripted experiment.</p></Step>
                <Step><h3>Inspect the permission boundary</h3><p>The model and prompt will stay identical. Separate execution roles will determine document access.</p></Step>
                <Step><h3>Read the observed result</h3><p>Future reports will separate attempted retrieval, actual retrieval, and exposure.</p></Step>
              </Stepper>}
            </div>}
          </div>
          <div className="component-source-header"><span><Braces size={15} /> Example usage</span><CopyButton text={source} label="Copy component example" /></div>
          <pre className="component-source"><code>{source}</code></pre>
          <div className="component-adaptations"><h3>Adapted for the lab</h3><span><Check size={14} /> Keyboard access</span><span><Check size={14} /> Reduced motion</span><span><Check size={14} /> Clear provenance</span></div>
        </section>
      </div>
    </>
  );
}

const frontendCommand = 'cd frontend\nnpm ci\nnpm run dev';
const backendCommand = "python3 -m venv .venv\n.venv/bin/python -m pip install -e '.[dev]'\n.venv/bin/python -m uvicorn beacon.api:app --host 127.0.0.1 --port 8000";

function LocalSetup({ api }: { api: ReturnType<typeof useApiHealth> }) {
  return (
    <>
      <PageHeading title="Start local. Keep the boundary clear." description="The interface and its session-protected simulation API run on your machine. AWS is not required for this stage." />
      <PreviewNotice />
      <section className="connection-panel">
        <div><span className="connection-icon"><Code2 size={22} /></span><div><h2>Local Python API</h2><p>{api.state === 'connected' ? `Connected · v${api.health?.version} · local simulation` : api.state === 'checking' ? 'Checking the local health endpoint…' : 'Not connected. Start the API using the command below.'}</p></div></div>
        <button className="button secondary small" disabled={api.state === 'checking'} onClick={() => void api.refresh()}><RefreshCw size={15} className={api.state === 'checking' ? 'spin' : ''} /> Check connection</button>
      </section>
      <div className="setup-grid">
        <CommandPanel title="Frontend" subtitle="From the project root, in terminal one" code={frontendCommand} address="http://localhost:5173" />
        <CommandPanel title="Python API" subtitle="From the project root, in terminal two" code={backendCommand} address="http://127.0.0.1:8000/api/docs" />
      </div>
      <section className="scope-panel"><div className="panel-heading"><div><ShieldCheck size={18} /><h2>What this build can—and cannot—do</h2></div></div><div className="scope-columns"><div><h3>Implemented</h3><ul><li><Check size={15} /> Attack editor and paired local simulations</li><li><Check size={15} /> Four adapted React Bits components</li><li><Check size={15} /> Access graph, timeline, and replay</li><li><Check size={15} /> Validated JSON import and report export</li></ul></div><div><h3>Not enabled</h3><ul><li><LockKeyhole size={15} /> AWS resources or role switching</li><li><LockKeyhole size={15} /> Real model inference or AWS experiments</li><li><LockKeyhole size={15} /> S3 uploads or IAM modifications</li><li><LockKeyhole size={15} /> Public execution endpoints</li></ul></div></div></section>
    </>
  );
}

function CommandPanel({ title, subtitle, code, address }: { title: string; subtitle: string; code: string; address: string }) {
  return (
    <section className="command-panel"><div className="command-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><CopyButton text={code} label={`Copy ${title.toLowerCase()} startup command`} /></div><pre><code>{code}</code></pre><div className="command-address"><span className="local-dot" />{address}</div></section>
  );
}
