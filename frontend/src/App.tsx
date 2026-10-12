import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import {
  Activity, ArrowRight, ArrowUpRight, Box, Braces, Check,
  ChevronDown, ChevronRight, Code2, FileText,
  Layers3, LockKeyhole, Menu, MessageSquare, Network, RefreshCw,
  RadioTower, ShieldAlert, ShieldCheck, X,
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
const navigation = [
  { id: 'playground' as const, label: 'Playground' },
  { id: 'workbench' as const, label: 'Architecture' },
  { id: 'components' as const, label: 'Component bench' },
  { id: 'setup' as const, label: 'Local setup' },
];

export default function App() {
  const [page, setPage] = useState<Page>('playground');
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const mobile = useMediaQuery('(max-width: 800px)');
  const systemReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const motionReduced = reduceMotion || systemReducedMotion;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeNavButton = useRef<HTMLButtonElement>(null);
  const navDialog = useRef<HTMLElement>(null);
  const moreMenu = useRef<HTMLDetailsElement>(null);
  const moreTrigger = useRef<HTMLElement>(null);
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
    if (moreMenu.current) moreMenu.current.open = false;
  }

  function openGuide() {
    setMobileNavOpen(false);
    if (moreMenu.current) moreMenu.current.open = false;
    setGuideOpen(true);
  }

  function signOut() {
    // Full navigation discards in-memory drafts/captures; no redirect URL input.
    window.location.replace('/oauth2/sign_out');
  }

  useEffect(() => {
    const onRestore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onRestore);
    return () => window.removeEventListener('pageshow', onRestore);
  }, []);

  function containNavFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(navDialog.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <MotionConfig reducedMotion={motionReduced ? 'always' : 'user'}>
      <div className="app-shell" data-reduced-motion={motionReduced ? 'true' : undefined}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="app-header" inert={mobile && mobileNavOpen}>
          <a className="brand" href="#main-content" onClick={() => navigate('playground')} aria-label="Beacon home">
            <span className="brand-mark"><RadioTower size={21} strokeWidth={1.7} /></span><span>Beacon</span>
          </a>
          <nav className="primary-nav" aria-label="Main navigation">
            {navigation.slice(0, 2).map(({ id, label }) => (
              <button key={id} className="header-nav-item" aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                {page === id && <motion.span className="header-nav-selection" layoutId="header-navigation" transition={{ type: 'spring', stiffness: 440, damping: 38 }} aria-hidden="true" />}<span>{label}</span>
              </button>
            ))}
          </nav>
          <details ref={moreMenu} className="nav-more" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; moreTrigger.current?.focus(); } }}>
            <summary ref={moreTrigger}>More <ChevronDown size={14} /></summary>
            <div className="nav-more-content">
              {navigation.slice(2).map(({ id, label }) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</button>)}
               <button onClick={openGuide}>Quick guide</button>
               {api.health?.access_mode === 'sso' && <button onClick={signOut}>Sign out</button>}
              <button aria-label={reduceMotion ? 'Restore system motion preference' : 'Reduce motion'} aria-pressed={reduceMotion} onClick={() => setReduceMotion(!reduceMotion)}>{reduceMotion ? 'Use system motion' : 'Reduce motion'}</button>
            </div>
          </details>
          <button ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
        </header>
        {mobile && mobileNavOpen && <div className="mobile-navigation-layer">
          <div className="nav-scrim" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
          <aside ref={navDialog} id="mobile-navigation" className="nav-drawer" role="dialog" aria-modal="true" aria-labelledby="navigation-title" onKeyDown={containNavFocus}>
            <div className="nav-drawer-heading"><h2 id="navigation-title">Navigation</h2><button ref={closeNavButton} className="icon-button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={20} /></button></div>
            <nav aria-label="Mobile navigation">{navigation.map(({ id, label }) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</button>)}</nav>
            <div className="nav-drawer-tools"><button onClick={openGuide}>Quick guide</button>{api.health?.access_mode === 'sso' && <button onClick={signOut}>Sign out</button>}<button aria-label={reduceMotion ? 'Restore system motion preference' : 'Reduce motion'} aria-pressed={reduceMotion} onClick={() => setReduceMotion(!reduceMotion)}>{reduceMotion ? 'Use system motion' : 'Reduce motion'}</button></div>
          </aside>
        </div>}
        <div className="main-shell" inert={mobile && mobileNavOpen}>
          <main id="main-content" className="main-content" tabIndex={-1}>
            {page === 'playground' && <Playground experiment={experiment} reduceMotion={motionReduced} />}
            {page === 'workbench' && <Workbench />}
            {page === 'components' && <ComponentBench reduceMotion={motionReduced} />}
            {page === 'setup' && <LocalSetup api={api} />}
          </main>
        </div>
        {guideOpen && <SetupGuide reduceMotion={motionReduced} onClose={() => { setGuideOpen(false); (mobile ? menuButton.current : moreTrigger.current)?.focus(); }} />}
      </div>
    </MotionConfig>
  );
}

function PreviewNotice({ children }: { children: ReactNode }) {
  return <p className="context-note">{children}</p>;
}

const architectureDetails: Record<ArchitectureNode, { title: string; detail: string }> = {
  question: { title: 'A question starts the workflow.', detail: 'The future assistant will answer leave-policy questions. The same question will be used for both permission configurations.' },
  model: { title: 'The model proposes an action.', detail: 'Bedrock will return a structured tool request. The model will not hold AWS credentials or directly retrieve S3 objects.' },
  backend: { title: 'The backend executes the request.', detail: 'A document identifier maps to a fixed S3 key. The execution role determines access, not the model.' },
};

function Workbench() {
  const [node, setNode] = useState<ArchitectureNode>('backend');
  const [document, setDocument] = useState<'policy' | 'payroll'>('policy');
  const [role, setRole] = useState<Role>('protected');
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const nodeButtons = [
    { id: 'question' as const, label: 'User question', subtitle: 'One shared input', icon: MessageSquare },
    { id: 'model' as const, label: 'AI assistant', subtitle: 'Planned Bedrock model', icon: Box },
    { id: 'backend' as const, label: 'Document tool', subtitle: 'Planned Lambda function', icon: Code2 },
  ];

  return (
    <>
      <PageHeading title="Architecture" />
      <PreviewNotice>Planned AWS setup. No resources are deployed.</PreviewNotice>
      <section className="architecture-panel" aria-labelledby="architecture-title">
        <div className="panel-heading"><div><h2 id="architecture-title">Request flow</h2></div><span className="text-note">Select a step</span></div>
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
              {document === 'policy' ? <><p>Employees receive 20 days of annual leave.</p><p>Leave requests require manager approval.</p></> : <><p>Fictional employee IDs, payroll values, and an exposure marker.</p><p>No real employee information.</p></>}
            </div>}
          </div>
          <p className="panel-footnote">Preview only. No S3 uploads.</p>
        </section>
        <section className="permissions-panel" aria-labelledby="permissions-title">
          <div className="panel-heading"><div><span className="panel-icon"><LockKeyhole size={17} /></span><h2 id="permissions-title">Compare the permissions</h2></div><span className="tiny-label">Not provisioned</span></div>
          <div className="permission-lanes">
            <PermissionLane role="vulnerable" selected={role === 'vulnerable'} onSelect={() => setRole('vulnerable')} />
            <PermissionLane role="protected" selected={role === 'protected'} onSelect={() => setRole('protected')} />
          </div>
          <div className="role-inspector" aria-live="polite"><span className="inspection-label">Selected boundary</span><strong>{role === 'protected' ? 'Protected lab role' : 'Vulnerable lab role'}</strong><p>{role === 'protected' ? 'Intended scope: read the policy only. A payroll request must be denied by AWS in the future live test.' : 'Intended scope: read exactly the two synthetic lab objects. No IAM changes, other buckets, or role assumption.'}</p></div>
        </section>
      </div>
    </>
  );
}

function PermissionLane({ role, selected, onSelect }: { role: Role; selected: boolean; onSelect: () => void }) {
  const protectedRole = role === 'protected';
  const Icon = protectedRole ? ShieldCheck : ShieldAlert;
  return (
    <article className={`permission-lane ${role}`} data-selected={selected}>
      <button className="lane-heading" aria-pressed={selected} aria-label={`Inspect ${role} permissions`} onClick={onSelect}><Icon size={21} /><span>{protectedRole ? 'Protected' : 'Vulnerable'}<small>Separate execution role</small></span><span className="lane-selected-dot" /></button>
      <div className="permission-row"><FileText size={15} /><span>Leave policy</span><span className="permission-status allowed"><Check size={12} /> Allowed*</span></div>
      <div className="permission-row"><LockKeyhole size={15} /><span>Payroll</span><span className={`permission-status ${protectedRole ? 'restricted' : 'allowed'}`}>{protectedRole ? <LockKeyhole size={12} /> : <Check size={12} />}{protectedRole ? 'Restricted*' : 'Allowed*'}</span></div>
      <p className="planned-permission-note">* Planned permissions, not observed results.</p>
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
      <PageHeading title="Component bench" />
      <PreviewNotice>Visual previews only. No tools or AWS calls.</PreviewNotice>
      <div className="component-bench-grid">
        <section className="component-inventory" aria-labelledby="inventory-title">
          <div className="panel-heading"><div><Layers3 size={17} /><h2 id="inventory-title">Component library</h2></div></div>
          <AnimatedList items={componentNames} selectedIndex={component} onItemSelect={(_, index) => { setComponent(index); setPreviewState(0); }} label="React Bits components" reduceMotion={reduceMotion} renderItem={(item, index) => <><span className="component-option-icon">{index === 0 ? <Network size={18} /> : index === 1 ? <Layers3 size={18} /> : index === 2 ? <Code2 size={18} /> : <Activity size={18} />}</span><span><strong>{item}</strong><small>{componentDescriptions[index]}</small></span><ChevronRight size={15} /></>} />
          <div className="inventory-note"><a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits <ArrowUpRight size={14} /></a></div>
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
              <p className="preview-state-note">Preview state: {stateLabels[previewState]}.</p>
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
      <PageHeading title="Local setup" />
      <PreviewNotice>Runs on your machine. AWS and paid inference are disabled.</PreviewNotice>
      <section className="connection-panel">
        <div><div><h2>Local Python API</h2><p>{api.state === 'connected' ? `Connected (v${api.health?.version})` : api.state === 'checking' ? 'Checking connection...' : 'Not connected. Start the API below.'}</p></div></div>
        <button className="button secondary small" disabled={api.state === 'checking'} onClick={() => void api.refresh()}><RefreshCw size={15} className={api.state === 'checking' ? 'spin' : ''} /> Check connection</button>
      </section>
      <div className="setup-grid">
        <CommandPanel title="Frontend" subtitle="From the project root, in terminal one" code={frontendCommand} address="http://localhost:5173" />
        <CommandPanel title="Python API" subtitle="From the project root, in terminal two" code={backendCommand} address="http://127.0.0.1:8000/api/docs" />
      </div>
      <details className="scope-panel"><summary>Supported features</summary><div className="scope-columns"><div><h3>Available</h3><ul><li>Local comparisons</li><li>Access graph and replay</li><li>Report import and export</li></ul></div><div><h3>Not enabled</h3><ul><li>AWS resources or role switching</li><li>Live model inference</li><li>S3 uploads and IAM changes</li></ul></div></div></details>
    </>
  );
}

function CommandPanel({ title, subtitle, code, address }: { title: string; subtitle: string; code: string; address: string }) {
  return (
    <section className="command-panel"><div className="command-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><CopyButton text={code} label={`Copy ${title.toLowerCase()} startup command`} /></div><pre><code>{code}</code></pre><div className="command-address"><span className="local-dot" />{address}</div></section>
  );
}
