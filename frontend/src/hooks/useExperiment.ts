import { useEffect, useRef, useState } from 'react';
import { runSimulation } from '../lib/api';
import {
  CLEAN_POLICY, NORMAL_QUESTION, simulationInputSchema, validateRecord,
  type Behavior, type RunRecord, type Target,
} from '../lib/experiment';

export function useExperiment() {
  const [policy, setPolicy] = useState(CLEAN_POLICY);
  const [question, setQuestion] = useState(NORMAL_QUESTION);
  const [behavior, setBehavior] = useState<Behavior>('follow');
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [origin, setOrigin] = useState<'local-api' | 'imported'>('local-api');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayDelay, setReplayDelay] = useState(800);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!playing || !record) return;
    if (cursor >= record.events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setCursor(value => value + 1), replayDelay);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, record, replayDelay]);

  async function run(target: Target) {
    if (active.current) return;
    const parsed = simulationInputSchema.safeParse({ mode: 'simulation', idempotency_key: crypto.randomUUID(), policy, question, behavior, target });
    if (!parsed.success) {
      setError('Use a non-empty document up to 8 KiB and a question up to 1 KiB.');
      return;
    }
    active.current = true;
    setBusy(true); setError(null); setPlaying(false);
    const request = new AbortController();
    controller.current = request;
    const deadline = window.setTimeout(() => request.abort(), 10000);
    try {
      const result = await runSimulation(parsed.data, request.signal);
      setRecord(result); setOrigin('local-api'); setCursor(result.events.length - 1);
    } catch (error) {
      setError(error instanceof TypeError ? 'Cannot reach the local Beacon API. Start it on port 8000, then try again.' :
        error instanceof Error && error.name !== 'AbortError'
          ? error.message : 'The local request timed out. Check the API connection before trying again.');
    } finally {
      window.clearTimeout(deadline); active.current = false; setBusy(false);
    }
  }

  async function importRecord(file: File) {
    if (active.current) return;
    setError(null);
    if (file.size > 262144) { setError('Replay files must be smaller than 256 KiB.'); return; }
    active.current = true;
    setBusy(true);
    setPlaying(false);
    try {
      const next = await validateRecord(JSON.parse(await file.text()));
      setPlaying(false); setRecord(next); setOrigin('imported'); setCursor(next.events.length - 1);
      setPolicy(next.input.policy); setQuestion(next.input.question); setBehavior(next.input.behavior);
    } catch {
      setError('Invalid replay. Import a Beacon simulation JSON report with an intact document hash. Live AWS claims and unknown fields are not accepted.');
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  function selectEvent(index: number) { setPlaying(false); setCursor(index); }
  function togglePlayback() {
    if (!record) return;
    if (playing) { setPlaying(false); return; }
    if (cursor >= record.events.length - 1) setCursor(0);
    setPlaying(true);
  }
  function clear() {
    if (active.current) return;
    setPlaying(false); setRecord(null); setCursor(0); setError(null);
  }
  const dirty = record !== null && (policy !== record.input.policy || question !== record.input.question || behavior !== record.input.behavior);

  return {
    policy, setPolicy, question, setQuestion, behavior, setBehavior,
    record, origin, busy, error, setError, cursor, playing, replayDelay, setReplayDelay,
    dirty, run, importRecord, selectEvent, togglePlayback, clear,
  };
}
