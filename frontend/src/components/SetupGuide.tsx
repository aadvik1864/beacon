import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
        <h2 id="guide-title">Quick guide</h2>
        <button className="icon-button" aria-label="Close setup guide" onClick={() => ref.current?.close()}><X size={19} /></button>
      </div>
      <Stepper labels={['Documents', 'Permissions', 'Evidence']} reduceMotion={reduceMotion} onFinalStepCompleted={() => ref.current?.close()}>
        <Step>
          <h3>Edit the policy</h3>
          <p>Use the attack example to add an instruction requesting the synthetic payroll file, then run a comparison.</p>
          <div className="guide-callout">This is a scripted local simulation, not a live model or AWS test.</div>
        </Step>
        <Step>
          <h3>Compare access</h3>
          <p>The vulnerable profile can read the policy and payroll. The protected profile can read only the policy.</p>
          <div className="guide-callout">Future AWS tests will use separate Lambda execution roles. None have been deployed.</div>
        </Step>
        <Step>
          <h3>Inspect the run</h3>
          <p>Open Access details for each answer, or Inspect run for the event trace and access path. Export JSON to save a replay.</p>
          <div className="guide-callout">Local events do not prove AWS access or denial. Imported replay files are unverified.</div>
        </Step>
      </Stepper>
    </dialog>
  );
}
