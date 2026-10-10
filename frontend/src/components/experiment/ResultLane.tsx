import { FileText, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import CallChip from '../react-bits/CallChip';
import StatusMark from '../react-bits/StatusMark';
import CopyButton from '../CopyButton';
import { outcomeLabel, type AssistantResult } from '../../lib/experiment';

export default function ResultLane({ role, result, busy, captured, reduceMotion }: {
  role: 'vulnerable' | 'protected'; result?: AssistantResult; busy: boolean; captured: boolean; reduceMotion: boolean;
}) {
  const Icon = role === 'protected' ? ShieldCheck : ShieldAlert;
  const blocked = result?.outcome === 'DENIED_BY_APP';
  const risk = result?.payroll_delivered_to_model;
  return (
    <article className={`result-lane ${role}`} aria-labelledby={`${role}-result-title`}>
      <div className="result-lane-heading">
        <Icon size={22} />
        <div><h3 id={`${role}-result-title`}>{role === 'protected' ? 'Protected' : 'Vulnerable'} assistant</h3><span>Fixed local permission profile</span></div>
      </div>
      <div className="result-permissions"><FileText size={13} /> Policy allowed <span>·</span><LockKeyhole size={13} /> Payroll {role === 'protected' ? 'restricted' : 'allowed'}</div>
      {!result ? <div className="result-empty">
        <StatusMark status={busy ? 'running' : 'pending'} reduceMotion={reduceMotion} size={24} />
        <strong>{busy ? 'Waiting for the local API' : captured ? 'Not included in this run' : 'No result captured yet'}</strong>
        <p>{busy ? 'Only observed results will appear here.' : 'Run a simulation to inspect requests, permissions, and the final answer.'}</p>
      </div> : <>
        <div className="result-outcome" data-tone={risk ? 'risk' : blocked ? 'blocked' : 'neutral'}><StatusMark status={risk ? 'failed' : 'done'} label={outcomeLabel(result.outcome)} reduceMotion={reduceMotion} size={19} /></div>
        <div className="result-measurements">
          {[
            ['Payroll requested', result.payroll_requested], ['Payroll retrieved', result.payroll_retrieved],
            ['Reached scripted context', result.payroll_delivered_to_model], ['Included in answer', result.payroll_exposed],
          ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong data-yes={value}>{value ? 'Yes' : 'No'}</strong></div>)}
        </div>
        <div className="result-tool"><CallChip argument={result.payroll_requested ? 'payroll' : 'leave_policy'} status={blocked ? 'error' : 'done'} reduceMotion={reduceMotion} /></div>
        <div className="answer-header"><span>Final scripted answer</span><CopyButton text={result.answer} label={`Copy ${role} answer`} /></div>
        <pre className="result-answer"><code>{result.answer}</code></pre>
        <p className="result-explanation">{result.explanation}</p>
      </>}
    </article>
  );
}
