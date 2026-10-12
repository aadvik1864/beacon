import { useState } from 'react';
import { motion } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { FileText, FolderLock, LockKeyhole, ShieldAlert, ShieldCheck, Play } from 'lucide-react';
import SpotlightCard from '../react-bits/SpotlightCard';
import RubberSegment from '../react-bits/RubberSegment';
import StatusMark from '../react-bits/StatusMark';

export default function PermissionPreview({ busy, reduceMotion, illustrationOnly = false, compact = false }: { busy: boolean; reduceMotion: boolean; illustrationOnly?: boolean; compact?: boolean }) {
  const [document, setDocument] = useState('payroll');
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = reduceMotion || Boolean(systemReduced);
  const payroll = document === 'payroll';
  const SourceIcon = payroll ? FolderLock : FileText;

  return <SpotlightCard className={`permission-preview ${compact ? 'compact-preview' : ''}`} spotlightColor="#a9a0ee" spotlightSize={380} reduceMotion={reduceMotion}>
    <div className="permission-preview-heading"><h3>Same request. Different access.</h3><span>Illustration only</span></div>
    <p className="permission-preview-intro">Choose a fictional file to explore the two access limits.</p>
    <RubberSegment label="Preview document access" className="preview-document-control" value={document} disabled={busy} reduceMotion={reduceMotion}
      items={[{ value: 'leave_policy', label: <><FileText size={14} />Leave policy</>, ariaLabel: 'Preview leave policy access' }, { value: 'payroll', label: <><FolderLock size={14} />Payroll</>, ariaLabel: 'Preview payroll access' }]}
      onChange={setDocument} />
    <div className="permission-preview-diagram">
      <svg className="permission-preview-wires" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
        <path className="preview-wire-base" d="M115 130H240Q278 130 278 94V66Q278 52 295 52H457M240 130Q278 130 278 166V194Q278 208 295 208H457" />
        <motion.path key={`${document}-upper`} className="preview-wire allowed" d="M240 130Q278 130 278 94V66Q278 52 295 52H457"
          initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.55 }} />
        <motion.path key={`${document}-lower`} className={`preview-wire ${payroll ? 'restricted' : 'allowed'}`} d="M240 130Q278 130 278 166V194Q278 208 295 208H457"
          initial={{ opacity: reduced ? 1 : 0.4 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.35 }} />
      </svg>
      <div className="preview-source"><span><SourceIcon size={25} strokeWidth={1.5} /></span><strong>{payroll ? 'Payroll' : 'Leave policy'}</strong><small>Fictional file</small></div>
      <div className="preview-boundaries">
        <div className="preview-boundary"><div><ShieldAlert size={19} /><strong>Too much access</strong></div><span className="preview-access allowed"><span />Can read this file</span></div>
        <div className="preview-boundary"><div><ShieldCheck size={19} /><strong>Limited access</strong></div><span className={`preview-access ${payroll ? 'restricted' : 'allowed'}`}>{payroll ? <LockKeyhole size={12} /> : <span />}{payroll ? 'Cannot read this file' : 'Can read this file'}</span></div>
      </div>
    </div>
    <p className="preview-scope" aria-live="polite">{payroll ? 'Only the version with too much access can read payroll.' : 'Both versions can read the leave policy.'}</p>
    {!illustrationOnly && <div className="preview-empty" role="status">
      {busy ? <StatusMark status="running" reduceMotion={reduceMotion} size={18} /> : <Play size={15} />}
      <div><strong>{busy ? 'Running simulation...' : 'No results yet'}</strong><p>{busy ? 'Waiting for the simulation service.' : 'Run a comparison to record both answers. This is an illustration, not a result.'}</p></div>
    </div>}
  </SpotlightCard>;
}
