import { useEffect, useRef } from 'react';
import { FileText, LockKeyhole, ScanSearch, X } from 'lucide-react';
import Stepper, { Step } from './react-bits/Stepper';

export default function SetupGuide({ onClose, reduceMotion }: { onClose: () => void; reduceMotion: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="guide-dialog"
      aria-labelledby="guide-title"
      onClose={() => {
        // StrictMode closes and reopens the dialog during its effect check.
        // Ignore the queued close event if this dialog has already reopened.
        if (!ref.current?.open) onClose();
      }}
    >
      <div className="dialog-header">
        <div><span className="text-note">A quick orientation</span><h2 id="guide-title">How this lab will work</h2></div>
        <button className="icon-button" aria-label="Close setup guide" onClick={() => ref.current?.close()}><X size={19} /></button>
      </div>
      <Stepper labels={['Documents', 'Permissions', 'Evidence']} reduceMotion={reduceMotion} onFinalStepCompleted={() => ref.current?.close()}>
        <Step>
          <div className="guide-illustration"><FileText size={34} /><span>Document ≠ instruction</span></div>
          <h3>Read the policy. Don’t trust its instructions.</h3>
          <p>The future assistant will retrieve a leave policy. An embedded attack will try to make it request a separate, synthetic payroll file.</p>
          <div className="guide-callout">The Playground now runs a local scripted fixture. Real model behavior and AWS permission enforcement still require separate live tests.</div>
        </Step>
        <Step>
          <div className="guide-illustration"><LockKeyhole size={34} /><span>The boundary is outside the AI</span></div>
          <h3>Same model. Different AWS permissions.</h3>
          <p>Two separate Lambda functions will use fixed execution roles. One can read both lab documents; the other can read only the policy.</p>
          <div className="guide-callout">Changing a component preview does not change real permissions. No roles or buckets have been created.</div>
        </Step>
        <Step>
          <div className="guide-illustration"><ScanSearch size={34} /><span>Evidence before conclusions</span></div>
          <h3>Inspect what actually happened.</h3>
          <p>The local trace distinguishes a non-triggered attack, blocked retrieval, context delivery, and final disclosure. A future live test must separately capture real model behavior and S3 AccessDenied.</p>
          <div className="guide-callout">Local events are not AWS audit records. A model saying it read a file is not proof of exposure.</div>
        </Step>
      </Stepper>
    </dialog>
  );
}
