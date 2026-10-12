import { lazy, Suspense, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown, FileText, FlaskConical, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import MagneticButton from '../react-bits/MagneticButton';
import CopyButton from '../CopyButton';
import StatusMark from '../react-bits/StatusMark';
import ResultLane from './ResultLane';
import EventTimeline from './EventTimeline';
import PermissionPreview from './PermissionPreview';
import SpotlightCard from '../react-bits/SpotlightCard';
import RubberSegment from '../react-bits/RubberSegment';
import ClickSpark from '../react-bits/ClickSpark';
import {
  CLEAN_POLICY, INJECTED_POLICY, NORMAL_QUESTION, DIRECT_QUESTION,
  downloadText, markdownReport, utf8Bytes, type Behavior, type Target,
} from '../../lib/experiment';
import type { useExperiment } from '../../hooks/useExperiment';

const AccessGraph = lazy(() => import('./AccessGraph'));

export default function Playground({ experiment, reduceMotion, onOpenGuide }: {
  experiment: ReturnType<typeof useExperiment>; reduceMotion: boolean; onOpenGuide: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [target, setTarget] = useState<Target>('both');
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionView, setInspectionView] = useState<'events' | 'graph'>('events');
  const [graphVisited, setGraphVisited] = useState(false);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { policy, setPolicy, question, setQuestion, behavior, setBehavior, record, origin, busy, error, dirty } = experiment;
  const policyBytes = utf8Bytes(policy);
  const questionBytes = utf8Bytes(question);
  const invalid = !policy.trim() || !question.trim() || policyBytes > 8192 || questionBytes > 1024;
  const original = CLEAN_POLICY.split('\n');
  const edited = policy.split('\n');
  const diff: { type: 'same' | 'removed' | 'added'; text: string }[] = [];
  for (let index = 0; index < Math.max(original.length, edited.length); index++) {
    if (original[index] === edited[index]) diff.push({ type: 'same', text: original[index] });
    else {
      if (original[index] !== undefined) diff.push({ type: 'removed', text: original[index] });
      if (edited[index] !== undefined) diff.push({ type: 'added', text: edited[index] });
    }
  }

  function toggleInspection() {
    experiment.selectEvent(experiment.cursor);
    if (showInspection) setGraphVisited(false);
    setShowInspection(!showInspection);
  }

  function selectView(view: 'events' | 'graph') {
    setInspectionView(view);
    if (view === 'graph') setGraphVisited(true);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'events' : event.key === 'End' ? 'graph' : inspectionView === 'events' ? 'graph' : 'events';
    selectView(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus();
  }

  return (
    <>
      <section className="lab-introduction" aria-labelledby="lab-title"><div><h1 id="lab-title">Learn why AI needs access limits.</h1><p>Beacon is a hands-on security lab. Add a hidden instruction to a fictional document, then see what changes when an assistant can read too much.</p><p className="lab-safety">Scripted answers and fictional data. No live AI model or AWS calls.</p></div><div className="lab-introduction-actions"><MagneticButton className="button secondary" onClick={onOpenGuide}>Show me an example <ArrowRight size={16} /></MagneticButton><MagneticButton className="text-button" disabled={busy} onClick={() => fileInput.current?.click()}>Open a saved result</MagneticButton></div></section>
      <ol className="lab-steps" aria-label="How to try the lab"><li><span>1</span>Choose a document</li><li><span>2</span>Ask a question</li><li><span>3</span>Compare access</li></ol>
      <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="application/json,.json" aria-label="Import simulation replay" onChange={event => {
        const file = event.target.files?.[0];
        if (file) void experiment.importRecord(file);
        event.target.value = '';
      }} />
      {error && <div className="experiment-error" role="alert"><p>{error}</p></div>}

      <div className="playground-grid">
        <section className="attack-editor-panel" aria-labelledby="attack-editor-title">
          <SpotlightCard className="editor-surface" reduceMotion={reduceMotion}>
          <div className="draft-heading">
            <h2 id="attack-editor-title"><FileText size={17} />Your document</h2>
            <RubberSegment className="document-presets" label="Policy templates" reduceMotion={reduceMotion} disabled={busy}
              value={policy === CLEAN_POLICY ? 'clean' : policy === INJECTED_POLICY ? 'attack' : null}
              items={[{ value: 'clean', label: 'Original', ariaLabel: 'Restore original policy' }, { value: 'attack', label: <><FlaskConical size={12} />Hidden instruction</>, ariaLabel: 'Load hidden instruction example' }]}
              onChange={value => setPolicy(value === 'clean' ? CLEAN_POLICY : INJECTED_POLICY)} />
          </div>
          <label className="editor-label" htmlFor="policy-editor"><code>policies/leave-policy.txt</code><span data-invalid={policyBytes > 8192}>{policyBytes.toLocaleString()} / 8,192 bytes</span></label>
          <textarea id="policy-editor" className="policy-editor" value={policy} onChange={event => setPolicy(event.target.value)} disabled={busy} maxLength={8192} spellCheck={false} aria-invalid={!policy.trim() || policyBytes > 8192} aria-describedby="policy-help" />
           <p id="policy-help" className="editor-help">Edit this fictional leave policy. Use the hidden instruction example to request an unrelated private file. Nothing is uploaded.</p>

          <div className="question-section">
            <label htmlFor="question-editor">Question</label>
            <textarea id="question-editor" className="question-editor" value={question} onChange={event => setQuestion(event.target.value)} disabled={busy} maxLength={1024} aria-invalid={!question.trim() || questionBytes > 1024} aria-describedby="question-help" />
             <p id="question-help" className={questionBytes > 1024 ? 'input-error' : 'editor-help'}>{questionBytes > 1024 ? 'This question is too long. Keep it within 1,024 bytes.' : 'This scripted demo answers leave questions and payroll requests, not general questions.'}</p>
          </div>

          <details className="advanced-options">
            <summary>Options</summary>
            <div className="advanced-options-body">
              <label className="option-field">Question preset<select disabled={busy} value={question === NORMAL_QUESTION ? 'policy' : question === DIRECT_QUESTION ? 'payroll' : 'custom'} onChange={event => { if (event.target.value !== 'custom') setQuestion(event.target.value === 'policy' ? NORMAL_QUESTION : DIRECT_QUESTION); }}><option value="custom">Custom question</option><option value="policy">Leave allowance</option><option value="payroll">Direct payroll request</option></select></label>
              <label className="option-field" htmlFor="scripted-behavior">What the demo does</label>
              <select id="scripted-behavior" disabled={busy} value={behavior} onChange={event => setBehavior(event.target.value as Behavior)}>
                <option value="follow">Follow the hidden instruction</option><option value="ignore">Ignore the hidden instruction</option><option value="retrieve_only">Read the file, but leave it out of the answer</option>
              </select>
              <label className="option-field">Versions to compare<select disabled={busy} value={target} onChange={event => setTarget(event.target.value as Target)}><option value="both">Both access limits</option><option value="vulnerable">Too much access only</option><option value="protected">Limited access only</option></select></label>
              <MagneticButton className="text-button diff-toggle" aria-expanded={showDiff} aria-controls="policy-diff" onClick={() => setShowDiff(!showDiff)}>{showDiff ? 'Hide changes' : 'Compare with clean policy'}</MagneticButton>
              {showDiff && <pre id="policy-diff" className="policy-diff" aria-label="Policy differences">{diff.map((line, index) => <span key={index} data-change={line.type}>{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} {line.text}{'\n'}</span>)}</pre>}
            </div>
          </details>
          <ClickSpark className="run-controls" reduceMotion={reduceMotion}><MagneticButton className="button primary" disabled={busy || invalid} onClick={() => void experiment.run(target)}>{busy ? <StatusMark status="running" reduceMotion={reduceMotion} size={16} /> : <Play size={15} fill="currentColor" />}{busy ? 'Running...' : target === 'both' ? 'Run comparison' : target === 'protected' ? 'Run limited access' : 'Run too much access'}</MagneticButton></ClickSpark>
          </SpotlightCard>
        </section>

        <section className="comparison-panel" aria-labelledby="comparison-title">
          <div className="comparison-heading"><h2 id="comparison-title">{record ? 'Your results' : 'What you are comparing'}</h2>{record && <span className="capture-source">{origin === 'imported' ? 'Imported result. Source not verified.' : 'Recorded simulation'}</span>}</div>
          {dirty && <p className="draft-warning" role="status">Draft changed. Run again to update these results.</p>}
          {record ? <>
            <motion.div className="result-lanes" key={record.id} initial={{ opacity: reduceMotion || systemReduced ? 1 : 0.4 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion || systemReduced ? 0 : 0.25 }}>
              <ResultLane key={`vulnerable-${record.id}`} role="vulnerable" result={record.results.find(result => result.role === 'vulnerable')} reduceMotion={reduceMotion} />
              <ResultLane key={`protected-${record.id}`} role="protected" result={record.results.find(result => result.role === 'protected')} reduceMotion={reduceMotion} />
            </motion.div>
            <div className="report-toolbar">
              <details className="export-menu"><summary>Export</summary><div>
                <MagneticButton disabled={busy} onClick={() => downloadText(JSON.stringify(record, null, 2), `beacon-${record.id}.json`, 'application/json')}>Export JSON</MagneticButton>
                <MagneticButton disabled={busy} onClick={() => downloadText(markdownReport(record, origin === 'imported'), `beacon-${record.id}.md`, 'text/markdown')}>Export report</MagneticButton>
              </div></details>
              <details className="capture-details"><summary>Run info</summary><div>
                <dl><div><dt>Behavior</dt><dd>{record.input.behavior.replace('_', ' ')}</dd></div><div><dt>Local duration</dt><dd>{record.duration_ms.toFixed(3)} ms</dd></div></dl>
                <div className="capture-hash"><span>Document SHA-256</span><CopyButton text={record.document_hash} label="Copy captured document hash" /></div><code>{record.document_hash}</code>
              </div></details>
              <MagneticButton className="text-button clear-capture" repel disabled={busy} onClick={experiment.clear}>Clear capture</MagneticButton>
            </div>
          </> : <PermissionPreview busy={busy} reduceMotion={reduceMotion} />}
        </section>
      </div>

      {record && <section className="inspection-shell" aria-label="Run inspection">
        <MagneticButton className="inspection-toggle" aria-expanded={showInspection} aria-controls="run-inspection" onClick={toggleInspection}>Inspect run <ChevronDown size={16} /></MagneticButton>
        {showInspection && <div id="run-inspection">
          <div className="inspection-tabs" role="tablist" aria-label="Inspection view">
            <button id="events-tab" role="tab" data-view="events" aria-selected={inspectionView === 'events'} aria-controls="events-panel" tabIndex={inspectionView === 'events' ? 0 : -1} onKeyDown={navigateTabs} onClick={() => selectView('events')}>Events</button>
            <button id="graph-tab" role="tab" data-view="graph" aria-selected={inspectionView === 'graph'} aria-controls="graph-panel" tabIndex={inspectionView === 'graph' ? 0 : -1} onKeyDown={navigateTabs} onClick={() => selectView('graph')}>Access path</button>
          </div>
          <div id="events-panel" role="tabpanel" aria-labelledby="events-tab" hidden={inspectionView !== 'events'}><EventTimeline experiment={experiment} reduceMotion={reduceMotion} /></div>
          <div id="graph-panel" role="tabpanel" aria-labelledby="graph-tab" hidden={inspectionView !== 'graph'}>{(graphVisited || inspectionView === 'graph') && <Suspense fallback={<p className="graph-loading" role="status">Loading access path...</p>}><AccessGraph record={record} cursor={experiment.cursor} /></Suspense>}</div>
        </div>}
      </section>}
    </>
  );
}
