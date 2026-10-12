import CallChip from '../react-bits/CallChip';
import StatusMark from '../react-bits/StatusMark';
import CopyButton from '../CopyButton';
import SpotlightCard from '../react-bits/SpotlightCard';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { outcomeLabel, type AssistantResult } from '../../lib/experiment';

export default function ResultLane({ role, result, reduceMotion }: {
  role: 'vulnerable' | 'protected'; result?: AssistantResult; reduceMotion: boolean;
}) {
  const blocked = result?.outcome === 'DENIED_BY_APP';
  const risk = result?.payroll_delivered_to_model;
  return (
    <article className={`result-lane ${role}`} aria-labelledby={`${role}-result-title`}>
      <SpotlightCard className="result-surface" spotlightColor={role === 'protected' ? '#137665' : '#b42332'} reduceMotion={reduceMotion}>
      <div className="result-lane-heading"><div className="result-role-icon">{role === 'protected' ? <ShieldCheck size={21} strokeWidth={1.6} /> : <ShieldAlert size={21} strokeWidth={1.6} />}</div><div><h3 id={`${role}-result-title`}>{role === 'protected' ? 'Limited access' : 'Too much access'}</h3><span>{role === 'protected' ? 'Can read only the policy' : 'Can read the policy and payroll'}</span></div></div>
      {!result ? <p className="result-not-included">Not included in this run.</p> : <>
        <div className="result-outcome" data-tone={risk ? 'risk' : blocked ? 'blocked' : 'neutral'}><StatusMark status={result.outcome === 'ERROR' || risk ? 'failed' : result.outcome === 'NOT_TRIGGERED' ? 'pending' : 'done'} label={outcomeLabel(result.outcome)} reduceMotion={reduceMotion} size={16} /></div>
        <div className="answer-header"><span>Response</span><CopyButton text={result.answer} label={`Copy ${role} answer`} /></div>
        <pre className="result-answer"><code>{result.answer}</code></pre>
        <details className="result-details">
          <summary>Access details</summary>
          <div className="result-measurements">
            {[
               ['Payroll requested', result.payroll_requested], ['Payroll read', result.payroll_retrieved],
               ['Given to the demo assistant', result.payroll_delivered_to_model], ['Included in answer', result.payroll_exposed],
            ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value ? 'Yes' : 'No'}</strong></div>)}
          </div>
          <div className="result-tool"><CallChip argument={result.payroll_requested ? 'payroll' : 'leave_policy'} status={blocked ? 'error' : 'done'} reduceMotion={reduceMotion} /></div>
          <p className="result-explanation">{result.explanation}</p>
        </details>
      </>}
      </SpotlightCard>
    </article>
  );
}
