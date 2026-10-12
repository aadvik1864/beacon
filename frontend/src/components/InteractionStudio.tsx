import { useState } from 'react';
import { Activity, ArrowUpRight, Braces, ChevronRight, Code2, Layers3, Network, RefreshCw } from 'lucide-react';
import PageHeading from './PageHeading';
import CopyButton from './CopyButton';
import Stepper, { Step } from './react-bits/Stepper';
import AnimatedList from './react-bits/AnimatedList';
import CallChip, { type CallChipStatus } from './react-bits/CallChip';
import StatusMark, { type StatusMarkStatus } from './react-bits/StatusMark';
import SpotlightCard from './react-bits/SpotlightCard';
import MagneticButton from './react-bits/MagneticButton';

const names = ['Stepper', 'AnimatedList', 'CallChip', 'StatusMark', 'Magnet'];
const descriptions = ['A short, navigable walkthrough.', 'A keyboard-friendly selectable list.', 'Feedback for a file request.', 'A clear operation state.', 'Subtle attraction and repulsion.'];
const chipStates: CallChipStatus[] = ['idle', 'running', 'done', 'error'];
const markStates: StatusMarkStatus[] = ['pending', 'running', 'done', 'failed'];
const labels = ['Queued', 'Running', 'Completed', 'Failed'];

export default function InteractionStudio({ reduceMotion }: { reduceMotion: boolean }) {
  const [component, setComponent] = useState(2);
  const [previewState, setPreviewState] = useState(0);
  const [listSelection, setListSelection] = useState(0);
  const [complete, setComplete] = useState(false);
  const [stepperKey, setStepperKey] = useState(0);
  const [magnetSelection, setMagnetSelection] = useState<'attract' | 'repel' | null>(null);
  const source = component === 2 ? `<CallChip status="${chipStates[previewState]}" />` : component === 3 ? `<StatusMark status="${markStates[previewState]}" />` : component === 1 ? '<AnimatedList items={items} onItemSelect={handleSelect} />' : component === 4 ? '<MagneticButton>Attract</MagneticButton>\n<MagneticButton repel>Repel</MagneticButton>' : '<Stepper labels={["Prepare", "Explore", "Finish"]}>...</Stepper>';
  return <>
    <PageHeading title="Interaction studio" description="Explore the small interactions used across Beacon. Every control keeps a keyboard and touch alternative." />
    <p className="context-note">Visual previews only. No tools or AWS calls.</p>
    <div className="component-bench-grid">
      <SpotlightCard className="component-inventory" reduceMotion={reduceMotion}>
        <div className="panel-heading"><h2>Choose an interaction</h2></div>
        <AnimatedList items={names} selectedIndex={component} onItemSelect={(_, index) => { setComponent(index); setPreviewState(0); }} label="React Bits components" reduceMotion={reduceMotion} renderItem={(item, index) => <><span className="component-option-icon">{index === 0 ? <Network size={18} /> : index === 1 ? <Layers3 size={18} /> : index === 2 ? <Code2 size={18} /> : <Activity size={18} />}</span><span><strong>{item}</strong><small>{descriptions[index]}</small></span><ChevronRight size={15} /></>} />
        <div className="inventory-note"><a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits <ArrowUpRight size={14} /></a></div>
      </SpotlightCard>
      <SpotlightCard className="component-preview-panel" reduceMotion={reduceMotion}>
        <div className="panel-heading"><h2>{names[component]}</h2><span className="text-note">Interaction preview</span></div>
        <div className="component-preview-stage">
          {(component === 2 || component === 3) && <><div className="preview-center">{component === 2 ? <CallChip status={chipStates[previewState]} reduceMotion={reduceMotion} onRetry={() => setPreviewState(0)} /> : <StatusMark status={markStates[previewState]} label="Component preview" size={28} reduceMotion={reduceMotion} />}</div><div className="preview-state-controls" role="group" aria-label="Preview state">{labels.map((label, index) => <MagneticButton key={label} aria-pressed={previewState === index} onClick={() => setPreviewState(index)}>{label}</MagneticButton>)}</div><p className="preview-state-note">Preview state: {labels[previewState]}.</p></>}
          {component === 1 && <div className="list-demo"><AnimatedList items={['Prepare a document', 'Compare file access', 'Explore the recorded result']} selectedIndex={listSelection} onItemSelect={(_, index) => setListSelection(index)} reduceMotion={reduceMotion} label="Illustrative workflow items" /><p className="preview-state-note">Selected: {listSelection + 1}. Use arrow keys, Home, or End. Tab leaves the list.</p></div>}
          {component === 0 && <div className="stepper-demo">{complete ? <div className="walkthrough-complete"><StatusMark status="done" label="Preview walkthrough completed" reduceMotion={reduceMotion} /><MagneticButton className="button secondary" onClick={() => { setComplete(false); setStepperKey(stepperKey + 1); }}>Restart preview <RefreshCw size={14} /></MagneticButton></div> : <Stepper key={stepperKey} labels={['Prepare', 'Explore', 'Finish']} reduceMotion={reduceMotion} onFinalStepCompleted={() => setComplete(true)}><Step><h3>Start with a document</h3><p>This is a navigation preview. The lab is where you edit documents and record real local simulations.</p></Step><Step><h3>Compare the two access limits</h3><p>The same request is used in both versions. Only the file access changes.</p></Step><Step><h3>Read the result</h3><p>Find out whether a private file was requested, read, or included in an answer.</p></Step></Stepper>}</div>}
          {component === 4 && <div className="magnet-demo"><div><MagneticButton className="button primary" aria-pressed={magnetSelection === 'attract'} onClick={() => setMagnetSelection('attract')}>Try attraction</MagneticButton><MagneticButton className="button secondary" repel aria-pressed={magnetSelection === 'repel'} onClick={() => setMagnetSelection('repel')}>Try repulsion</MagneticButton></div><p>Move your pointer across a button. Its content follows or moves gently away; the click area stays still.</p><p>On touch screens or with reduced motion, both buttons stay still and work normally.</p><p aria-live="polite">{magnetSelection ? `${magnetSelection === 'attract' ? 'Attraction' : 'Repulsion'} selected. The button activates normally with touch, Enter, or Space.` : 'Choose either button to check its normal activation.'}</p></div>}
        </div>
        <details className="component-code"><summary>See the component example</summary><div className="component-source-header"><span><Braces size={15} />Example usage</span><CopyButton text={source} label="Copy component example" /></div><pre className="component-source"><code>{source}</code></pre></details>
      </SpotlightCard>
    </div>
  </>;
}
