import { describe, expect, it } from 'vitest';
import { baselineRecord } from '../test/runFixture';
import { CLEAN_POLICY, markdownReport, runRecordSchema, simulationInputSchema, utf8Bytes, validateRecord } from './experiment';

describe('bounded simulation inputs', () => {
  it('counts bytes rather than only JavaScript characters', () => {
    expect(utf8Bytes('é')).toBe(2);
    expect(simulationInputSchema.safeParse({
      mode: 'simulation', idempotency_key: crypto.randomUUID(), policy: 'é'.repeat(5000),
      question: 'Leave allowance?', behavior: 'follow', target: 'both',
    }).success).toBe(false);
  });

  it('rejects unknown fields and live execution requests', () => {
    const input = { mode: 'simulation', idempotency_key: crypto.randomUUID(), policy: CLEAN_POLICY, question: 'Leave allowance?', behavior: 'follow', target: 'both' };
    expect(simulationInputSchema.safeParse(input).success).toBe(true);
    expect(simulationInputSchema.safeParse({ ...input, mode: 'aws' }).success).toBe(false);
    expect(simulationInputSchema.safeParse({ ...input, role_arn: 'arbitrary' }).success).toBe(false);
  });
});

describe('untrusted replay validation', () => {
  it('accepts a complete simulation record with an intact document hash', async () => {
    const record = await baselineRecord();
    expect(await validateRecord(record)).toEqual(record);
  });

  it('rejects a modified document even if the record structure is valid', async () => {
    const record = await baselineRecord();
    record.input.policy += '\nModified';
    await expect(validateRecord(record)).rejects.toThrow('recorded hash');
  });

  it('rejects cloud claims, oversized fields, and additional metadata fields', async () => {
    const record = await baselineRecord();
    for (const invalid of [
      { ...record, aws_used: true }, { ...record, model_is_live: true },
      { ...record, schema_version: 2 }, { ...record, credentials: 'never accepted' },
      { ...record, input: { ...record.input, policy: 'a'.repeat(8193) } },
    ]) expect(runRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects duplicate roles, missing actors, event reordering, and truncated traces', async () => {
    const record = await baselineRecord();
    const reordered = structuredClone(record);
    reordered.events[1].sequence = 4;
    const wrongActor = structuredClone(record);
    wrongActor.events[1].actor = 'vulnerable';
    const badOffset = structuredClone(record);
    badOffset.events[1].offset_ms = 100;
    for (const invalid of [
      reordered, wrongActor, badOffset,
      { ...record, results: [...record.results, ...record.results] },
      { ...record, events: record.events.slice(0, -1) },
    ]) expect(runRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects results that contradict the permission profile or evidence trace', async () => {
    const record = await baselineRecord();
    const exposure = structuredClone(record);
    exposure.results[0].outcome = 'EXPOSED';
    const measurement = structuredClone(record);
    measurement.results[0].payroll_exposed = true;
    const mismatchedEvent = structuredClone(record);
    mismatchedEvent.events[1].metadata.document_id = 'payroll';
    for (const invalid of [exposure, measurement, mismatchedEvent]) {
      expect(runRecordSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('exports reports with explicit provenance and safely fenced untrusted content', async () => {
    const record = await baselineRecord();
    record.input.question = '```\n<img src=x onerror=alert(1)>\n```';
    const report = markdownReport(record, true);
    expect(report).toContain('not AWS IAM');
    expect(report).toContain('file authenticity is unverified');
    expect(report).toContain('````\n```\n<img');
    expect(report).toContain(record.document_hash);
  });
});
