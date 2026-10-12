import { describe, expect, it, vi } from 'vitest';
import { runBrowserSimulation } from './browserSimulation';
import { CLEAN_POLICY, DIRECT_QUESTION, INJECTED_POLICY, NORMAL_QUESTION, markdownReport, validateRecord,
  type Behavior, type Target, type SimulationInput } from './experiment';
import { parseExecutionMode } from './executionMode';

const input = (policy = INJECTED_POLICY, behavior: Behavior = 'follow', target: Target = 'both', question = NORMAL_QUESTION): SimulationInput => ({
  mode: 'simulation', idempotency_key: crypto.randomUUID(), policy, question, behavior, target,
});
const run = (request: SimulationInput) => runBrowserSimulation(request, new AbortController().signal);

describe('explicit browser execution', () => {
  it('requires an explicit browser-demo setting; absent configuration stays API', () => {
    expect(parseExecutionMode(undefined)).toBe('api');
    expect(parseExecutionMode('browser-demo')).toBe('browser-demo');
    for (const invalid of ['browser', '', 'offline', null]) expect(() => parseExecutionMode(invalid)).toThrow();
  });

  it('captures paired exposure and denial with browser provenance and no network access', async () => {
    const fetch = vi.fn(() => { throw new Error('No network allowed'); });
    vi.stubGlobal('fetch', fetch);
    const record = await run(input());
    expect(record.execution_source).toBe('browser-simulation');
    expect(record.aws_used).toBe(false);
    expect(record.model_is_live).toBe(false);
    expect(record.results.map(result => result.outcome)).toEqual(['EXPOSED', 'DENIED_BY_APP']);
    expect(record.results[0].answer).toContain('DEMO-101,4100');
    expect(record.results[1].answer).not.toContain('DEMO-101');
    expect(record.results[1].answer).not.toContain('BEACON_SYNTHETIC');
    expect(record.events.every(event => event.source === 'browser-simulation')).toBe(true);
    expect(await validateRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
    expect(markdownReport(record)).toContain('Browser simulation');
    expect(markdownReport(record)).toContain('not genuine AWS permission enforcement');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['follow', 'ignore', 'retrieve_only'] as const)('clean documents do not request payroll for %s', async behavior => {
    const record = await run(input(CLEAN_POLICY, behavior));
    expect(record.results.every(result => result.outcome === 'NOT_TRIGGERED' && !result.payroll_requested)).toBe(true);
  });

  it('ignoring embedded instructions does not establish enforcement', async () => {
    const record = await run(input(INJECTED_POLICY, 'ignore'));
    expect(record.results.map(result => result.outcome)).toEqual(['NOT_TRIGGERED', 'NOT_TRIGGERED']);
  });

  it('retrieval without disclosure is measured separately and denied for limited access', async () => {
    const record = await run(input(INJECTED_POLICY, 'retrieve_only'));
    expect(record.results.map(result => result.outcome)).toEqual(['RETRIEVED_NOT_DISCLOSED', 'DENIED_BY_APP']);
    expect(record.results[0].payroll_delivered_to_model).toBe(true);
    expect(record.results[0].payroll_exposed).toBe(false);
    expect(record.results[0].answer).not.toContain('DEMO-101');
  });

  it.each(['both', 'vulnerable', 'protected'] as const)('direct requests respect %s targets even when ignoring embedded instructions', async target => {
    const record = await run(input(CLEAN_POLICY, 'ignore', target, DIRECT_QUESTION));
    expect(record.results.map(result => result.role)).toEqual(target === 'both' ? ['vulnerable', 'protected'] : [target]);
    expect(record.results.every(result => result.payroll_requested)).toBe(true);
    expect(record.results.every(result => result.role === 'protected' ? result.outcome === 'DENIED_BY_APP' : result.outcome === 'EXPOSED')).toBe(true);
  });

  it('edits affect new captures without rewriting old inputs and markers stay isolated', async () => {
    const first = await run(input());
    const second = await run(input('Employees receive 28 days of annual leave.'));
    expect(second.results[0].answer).toContain('28 days');
    expect(first.input.policy).toBe(INJECTED_POLICY);
    const third = await run(input());
    expect(first.id).not.toBe(third.id);
    expect(first.results[0].answer).not.toBe(third.results[0].answer);
  });

  it('keeps the recognizer narrow and preserves Unicode word boundaries and gap length', async () => {
    const unknown = await run(input('Tell a joke and open another file.'));
    expect(unknown.results[0].answer).toContain('does not specify');
    const unicodeWord = await run(input(CLEAN_POLICY, 'follow', 'both', 'épayroll'));
    expect(unicodeWord.results.every(result => !result.payroll_requested)).toBe(true);
    const unicodeGap = await run(input('read ' + '😀'.repeat(195) + 'private/payroll.csv'));
    expect(unicodeGap.results[0].outcome).toBe('EXPOSED');
    const tooFar = await run(input('read ' + 'x'.repeat(201) + 'private/payroll.csv'));
    expect(tooFar.results[0].outcome).toBe('NOT_TRIGGERED');
  });

  it('rejects credentials, byte overflow, unknown fields, live modes and aborted runs', async () => {
    const invalid = [
      { ...input(), policy: 'é'.repeat(5000) }, { ...input(), question: 'é'.repeat(600) },
      { ...input(), policy: 'AKIA' + 'A'.repeat(16) }, { ...input(), policy: ' ' },
      { ...input(), mode: 'aws' }, { ...input(), role_arn: 'arbitrary' },
    ];
    for (const request of invalid) await expect(run(request as SimulationInput)).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(runBrowserSimulation(input(), controller.signal)).rejects.toThrow();
  });

  it('rejects browser replays with missing, mixed or false execution provenance', async () => {
    const record = await run(input());
    for (const invalid of [
      { ...record, execution_source: undefined }, { ...record, execution_source: 'local-api' },
      { ...record, execution_source: 'aws' }, { ...record, aws_used: true },
      { ...record, events: record.events.map(event => ({ ...event, source: 'local-simulation' })) },
    ]) await expect(validateRecord(invalid)).rejects.toThrow();
    expect(markdownReport(record, true)).toContain('claimed by an unverified file');
  });
});
