import { useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Pause, Play, ScanSearch } from 'lucide-react';
import AnimatedList from '../react-bits/AnimatedList';
import CopyButton from '../CopyButton';
import MagneticButton from '../react-bits/MagneticButton';
import type { useExperiment } from '../../hooks/useExperiment';

export default function EventTimeline({ experiment, reduceMotion }: { experiment: ReturnType<typeof useExperiment>; reduceMotion: boolean }) {
  const [actor, setActor] = useState('all');
  const [kind, setKind] = useState('all');
  const { record, cursor, selectEvent, playing, togglePlayback, replayDelay, setReplayDelay } = experiment;
  const filtered = record?.events.filter(event => (actor === 'all' || event.actor === actor) && (kind === 'all' || event.event_type === kind)) ?? [];
  const selected = record?.events[cursor];
  const selectedIndex = filtered.findIndex(event => event.sequence === cursor + 1);

  return (
    <section className="timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading"><div><Clock3 size={17} /><h2 id="timeline-title">Events</h2></div></div>
      {!record ? <div className="timeline-empty"><ScanSearch size={25} /><h3>No events to inspect yet.</h3><p>Run a local simulation or import a saved simulation report.</p></div> : <>
        <div className="replay-toolbar">
          <div className="replay-buttons"><MagneticButton className="icon-button" aria-label="Previous event" disabled={cursor === 0} onClick={() => selectEvent(cursor - 1)}><ArrowLeft size={16} /></MagneticButton><MagneticButton className="button secondary small" onClick={togglePlayback}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause replay' : 'Play replay'}</MagneticButton><MagneticButton className="icon-button" aria-label="Next event" disabled={cursor === record.events.length - 1} onClick={() => selectEvent(cursor + 1)}><ArrowRight size={16} /></MagneticButton></div>
          <label className="replay-speed">Replay pace<select value={replayDelay} onChange={event => setReplayDelay(Number(event.target.value))}><option value={1600}>1.6s / event</option><option value={800}>0.8s / event</option><option value={400}>0.4s / event</option></select></label>
        </div>
        <div className="timeline-scrubber"><input type="range" min={0} max={record.events.length - 1} value={cursor} aria-label="Scrub recorded events" onChange={event => selectEvent(Number(event.target.value))} /><span>Event {cursor + 1} / {record.events.length}</span></div>
        <p className="replay-disclaimer">Replay uses saved events. It does not run the simulation again.</p>
        <div className="timeline-filters"><label>Version<select aria-label="Filter events by actor" value={actor} onChange={event => setActor(event.target.value)}><option value="all">All versions</option><option value="vulnerable">Too much access</option><option value="protected">Limited access</option><option value="system">Lab service</option></select></label><label>Event<select aria-label="Filter events by type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All events</option><option value="document_requested">File requests</option><option value="document_retrieved">Files read</option><option value="access_denied">Blocked requests</option><option value="answer_generated">Final answers</option></select></label><span>{filtered.length} matching events</span></div>
        <div className="timeline-body">
          <div className="timeline-list">
            {filtered.length ? <AnimatedList items={filtered.map(event => event.id)} selectedIndex={selectedIndex} reduceMotion={reduceMotion} label="Recorded simulation events" onItemSelect={(_, index) => selectEvent(filtered[index].sequence - 1)} renderItem={(_, index) => {
              const event = filtered[index];
              return <><span className="event-sequence">{event.sequence}</span><span><strong>{event.summary}</strong><small>{event.actor} ({event.offset_ms.toFixed(3)} ms)</small></span><span className="event-type-mark" data-denied={event.event_type === 'access_denied'}>{event.event_type === 'access_denied' ? 'Blocked' : event.event_type === 'document_retrieved' ? 'Retrieved' : ''}</span></>;
            }} /> : <p className="filter-empty">No events match these filters.</p>}
          </div>
          <div className="event-inspector">
            {selected && <><div className="event-inspector-heading"><span>Selected event</span><CopyButton text={JSON.stringify(selected, null, 2)} label="Copy selected event" /></div><h3>{selected.summary}</h3><dl><div><dt>Source</dt><dd>Local simulation</dd></div><div><dt>Actor</dt><dd>{selected.actor}</dd></div><div><dt>Type</dt><dd>{selected.event_type}</dd></div><div><dt>Timestamp</dt><dd>{selected.timestamp}</dd></div></dl><pre><code>{JSON.stringify(selected.metadata, null, 2)}</code></pre></>}
          </div>
        </div>
      </>}
    </section>
  );
}
