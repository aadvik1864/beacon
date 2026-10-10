import { lazy, Suspense, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Braces, CloudOff, Download, FileText, FlaskConical, LockKeyhole, Play, RotateCcw, Upload } from 'lucide-react';
import PageHeading from '../PageHeading';
import CopyButton from '../CopyButton';
import ResultLane from './ResultLane';
import EventTimeline from './EventTimeline';
import {
  CLEAN_POLICY, INJECTED_POLICY, NORMAL_QUESTION, DIRECT_QUESTION,
  downloadText, markdownReport, utf8Bytes, type Behavior,
} from '../../lib/experiment';
import type { useExperiment } from '../../hooks/useExperiment';

const AccessGraph = lazy(() => import('./AccessGraph'));

export default function Playground({ experiment, reduceMotion }: { experiment: ReturnType<typeof useExperiment>; reduceMotion: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [showDiff, setShowDiff] = useState(false);
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

  return (
    <>
      <PageHeading title={<>Same attack.<br />Different access.</>} description="Edit the document, capture a paired simulation, then inspect the exact permission boundary." provenance={origin === 'imported' && record ? 'Imported simulation replay' : 'Local simulation'} stage="Scripted fixture · no AWS" action={<button className="button secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15} /> Import replay</button>} />
      <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="application/json,.json" aria-label="Import simulation replay" onChange={event => { const file = event.target.files?.[0]; if (file) void experiment.importRecord(file); event.target.value = ''; }} />
      <div className="preview-notice"><CloudOff size={18} /><p><strong>Scripted assistant. Local permission checks.</strong> These runs do not prove real prompt injection or AWS IAM enforcement.</p><span className="notice-tag">No paid inference</span></div>
      <div className="experiment-mode-bar"><span><FlaskConical size={15} /> Local simulation enabled</span><span><LockKeyhole size={14} /> Live AWS requires setup, cost review, and approval</span></div>
      {error && <div className="experiment-error" role="alert"><AlertTriangle size={18} /><p>{error}</p></div>}
      <div className="playground-grid">
        <section className="attack-editor-panel" aria-labelledby="attack-editor-title">
          <div className="panel-heading"><div><FileText size={17} /><h2 id="attack-editor-title">Prepare the document</h2></div><span className="tiny-label">Synthetic lab only</span></div>
          <div className="editor-actions"><button className="button secondary small" disabled={busy} onClick={() => setPolicy(INJECTED_POLICY)}><Braces size={14} /> Load attack example</button><button className="reset-policy" disabled={busy} onClick={() => setPolicy(CLEAN_POLICY)}><RotateCcw size={13} /> Restore clean policy</button></div>
          <label className="editor-label" htmlFor="policy-editor"><code>policies/leave-policy.txt</code><span data-invalid={policyBytes > 8192}>{policyBytes.toLocaleString()} / 8,192 bytes</span></label>
          <textarea id="policy-editor" className="policy-editor" value={policy} onChange={event => setPolicy(event.target.value)} disabled={busy} maxLength={8192} spellCheck={false} aria-invalid={!policy.trim() || policyBytes > 8192} aria-describedby="policy-help" />
          <p id="policy-help" className="editor-help">Untrusted task data. Edits are local drafts; nothing is uploaded to S3.</p>
          <button className="diff-toggle" aria-expanded={showDiff} aria-controls="policy-diff" onClick={() => setShowDiff(!showDiff)}><Braces size={14} />{showDiff ? 'Hide changes' : 'Compare with clean policy'}<span>{policy === CLEAN_POLICY ? 'Unchanged' : 'Modified'}</span></button>
          {showDiff && <pre id="policy-diff" className="policy-diff" aria-label="Policy differences">{diff.map((line, index) => <span key={index} data-change={line.type}>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '} {line.text}{'\n'}</span>)}</pre>}
          <div className="question-section">
            <label htmlFor="question-editor">Ask the assistant</label><textarea id="question-editor" className="question-editor" value={question} onChange={event => setQuestion(event.target.value)} disabled={busy} maxLength={1024} aria-invalid={!question.trim() || questionBytes > 1024} aria-describedby="question-help" />
            <div className="question-presets" role="group" aria-label="Question presets"><button disabled={busy} aria-pressed={question === NORMAL_QUESTION} onClick={() => setQuestion(NORMAL_QUESTION)}>Leave-policy question</button><button disabled={busy} aria-pressed={question === DIRECT_QUESTION} onClick={() => setQuestion(DIRECT_QUESTION)}>Direct payroll request</button></div>
            <p id="question-help" className="editor-help">{questionBytes.toLocaleString()} / 1,024 bytes. Fixture questions cover leave allowance or payroll access. Other language is not interpreted by an LLM.</p>
          </div>
          <div className="behavior-section"><label htmlFor="scripted-behavior">Scripted assistant behavior</label><select id="scripted-behavior" disabled={busy} value={behavior} onChange={event => setBehavior(event.target.value as Behavior)}><option value="follow">Follow a recognized injection</option><option value="ignore">Ignore embedded instructions</option><option value="retrieve_only">Retrieve without disclosing</option></select><p>This deliberately controls a deterministic fixture—not a model’s intelligence.</p></div>
          <div className="run-controls"><button className="button primary" disabled={busy || invalid} onClick={() => void experiment.run('both')}><Play size={15} />{busy ? 'Running local simulation…' : 'Run comparison'}</button><div><button disabled={busy || invalid} onClick={() => void experiment.run('vulnerable')}>Vulnerable only</button><button disabled={busy || invalid} onClick={() => void experiment.run('protected')}>Protected only</button></div><p>Free local execution. Inputs are snapshotted; duplicate submissions are blocked.</p></div>
        </section>
        <section className="comparison-panel" aria-labelledby="comparison-title">
          <div className="comparison-heading"><div><h2 id="comparison-title">Captured comparison</h2><p>Final results stay fixed while you replay the event trace.</p></div><span className="simulation-tag">Simulation</span></div>
          {record && <div className="snapshot-banner" data-dirty={dirty}><div><strong>{origin === 'imported' ? 'Imported replay · authenticity unverified' : 'Captured from the local API'}</strong><span>{dirty ? 'Draft changed. These results belong to the previous snapshot.' : `Scripted behavior: ${record.input.behavior} · ${record.duration_ms.toFixed(3)} ms local execution`}</span></div><CopyButton text={record.document_hash} label="Copy captured document hash" /></div>}
          <div className="result-lanes"><ResultLane role="vulnerable" result={record?.results.find(result => result.role === 'vulnerable')} captured={Boolean(record)} busy={busy} reduceMotion={reduceMotion} /><ResultLane role="protected" result={record?.results.find(result => result.role === 'protected')} captured={Boolean(record)} busy={busy} reduceMotion={reduceMotion} /></div>
          {record ? <div className="report-toolbar"><button className="button secondary small" disabled={busy} onClick={() => downloadText(JSON.stringify(record, null, 2), `beacon-${record.id}.json`, 'application/json')}><Download size={14} /> Export JSON</button><button className="button secondary small" disabled={busy} onClick={() => downloadText(markdownReport(record, origin === 'imported'), `beacon-${record.id}.md`, 'text/markdown')}><Download size={14} /> Export report</button><button className="clear-capture" disabled={busy} onClick={experiment.clear}>Clear capture</button></div> : <div className="comparison-empty-note"><ArrowRight size={16} /> Load the attack example, then run both profiles to see the contrast.</div>}
        </section>
      </div>
      <Suspense fallback={<div className="graph-loading" role="status">Loading the local access diagram…</div>}><AccessGraph record={record} cursor={experiment.cursor} /></Suspense>
      <EventTimeline experiment={experiment} reduceMotion={reduceMotion} />
    </>
  );
}
