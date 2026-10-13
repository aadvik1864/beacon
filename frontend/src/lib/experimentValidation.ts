import { z } from 'zod';
import { containsCredential } from './sensitive';
import { utf8Bytes } from './experiment';

// Disable Zod's optional code-generation probe so validation never attempts
// eval under the strict static-host CSP. All schema checks still run.
z.config({ jitless: true });

const role = z.enum(['vulnerable', 'protected']);
const behaviorSchema = z.enum(['follow', 'ignore', 'retrieve_only']);
const targetSchema = z.enum(['both', 'vulnerable', 'protected']);
const boundedPolicy = z.string().min(1).max(8192).refine(value => value.trim().length > 0 && utf8Bytes(value) <= 8192 && !containsCredential(value));
const boundedQuestion = z.string().min(1).max(1024).refine(value => value.trim().length > 0 && utf8Bytes(value) <= 1024 && !containsCredential(value));
export const simulationInputSchema = z.strictObject({
  mode: z.literal('simulation'), idempotency_key: z.uuid(),
  policy: boundedPolicy, question: boundedQuestion,
  behavior: behaviorSchema, target: targetSchema,
});
const eventSchema = z.strictObject({
  id: z.string().min(1).max(100), sequence: z.number().int().positive(),
  timestamp: z.iso.datetime({ offset: true }), offset_ms: z.number().nonnegative().finite(),
  actor: z.enum(['system', 'vulnerable', 'protected']),
  event_type: z.enum(['run_started', 'document_requested', 'document_retrieved', 'access_denied', 'document_delivered', 'model_decision', 'answer_generated', 'run_completed']),
  summary: z.string().max(2048), source: z.enum(['local-simulation', 'browser-simulation']),
  metadata: z.record(z.string().max(100), z.union([z.string().max(2048), z.number().int(), z.boolean()])),
});
const resultSchema = z.strictObject({
  role, outcome: z.enum(['NOT_TRIGGERED', 'DENIED_BY_APP', 'RETRIEVED_NOT_DISCLOSED', 'EXPOSED', 'ERROR']),
  answer: z.string().max(32768), explanation: z.string().max(2048),
  payroll_requested: z.boolean(), payroll_retrieved: z.boolean(),
  payroll_delivered_to_model: z.boolean(), payroll_exposed: z.boolean(),
}).superRefine((result, context) => {
  if ((result.payroll_exposed && !result.payroll_delivered_to_model) ||
      (result.payroll_delivered_to_model && !result.payroll_retrieved) ||
      (result.payroll_retrieved && !result.payroll_requested)) {
    context.addIssue({ code: 'custom', message: 'Inconsistent retrieval and exposure measurements.' });
  }
  const outcomeMatches = result.outcome === 'ERROR' || (
    result.outcome === 'NOT_TRIGGERED' ? !result.payroll_requested :
    result.outcome === 'DENIED_BY_APP' ? result.payroll_requested && !result.payroll_retrieved :
    result.outcome === 'EXPOSED' ? result.payroll_exposed :
    result.payroll_delivered_to_model && !result.payroll_exposed
  );
  if (!outcomeMatches || (result.role === 'protected' && result.payroll_retrieved)) {
    context.addIssue({ code: 'custom', message: 'Outcome contradicts the measurements or fixed local permission profile.' });
  }
});
export const runRecordSchema = z.strictObject({
  schema_version: z.literal(1), id: z.uuid(), mode: z.literal('simulation'), product: z.literal('Beacon'),
  // Existing schema-v1 API reports omitted this field. Their event source still
  // has to be local-simulation; absence cannot validate a browser event trace.
  execution_source: z.enum(['local-api', 'browser-simulation']).optional(),
  started_at: z.iso.datetime({ offset: true }), completed_at: z.iso.datetime({ offset: true }),
  duration_ms: z.number().nonnegative().finite(), document_hash: z.string().regex(/^[a-f0-9]{64}$/),
  model_id: z.literal('scripted-fixture-v1'), model_is_live: z.literal(false), aws_used: z.literal(false),
  input: z.strictObject({ policy: boundedPolicy, question: boundedQuestion, behavior: behaviorSchema, target: targetSchema }),
  results: z.array(resultSchema).min(1).max(2), events: z.array(eventSchema).min(2).max(256),
}).superRefine((record, context) => {
  const expectedRoles = record.input.target === 'both' ? ['vulnerable', 'protected'] : [record.input.target];
  if (record.results.length !== expectedRoles.length || expectedRoles.some(value => record.results.filter(result => result.role === value).length !== 1)) {
    context.addIssue({ code: 'custom', message: 'Results must match the captured targets.' });
  }
  record.events.forEach((event, index) => {
    const expectedSource = record.execution_source === 'browser-simulation' ? 'browser-simulation' : 'local-simulation';
    if (event.sequence !== index + 1 || event.id !== `${record.id}:${event.sequence}` ||
        event.source !== expectedSource ||
        event.offset_ms > record.duration_ms || (index > 0 && event.offset_ms < record.events[index - 1].offset_ms) ||
        (event.actor !== 'system' && !expectedRoles.includes(event.actor))) {
      context.addIssue({ code: 'custom', message: 'Invalid event order or actor.' });
    }
  });
  if (new Set(record.events.map(event => event.id)).size !== record.events.length) {
    context.addIssue({ code: 'custom', message: 'Event identifiers must be unique.' });
  }
  const first = record.events[0];
  const last = record.events[record.events.length - 1];
  if (first.actor !== 'system' || first.event_type !== 'run_started' ||
      last.actor !== 'system' || last.event_type !== 'run_completed' ||
      Date.parse(record.completed_at) < Date.parse(record.started_at)) {
    context.addIssue({ code: 'custom', message: 'A complete run must have valid start and completion events.' });
  }
  for (const result of record.results) {
    const observed = record.events.filter(event => event.actor === result.role);
    const requested = observed.some(event => event.event_type === 'document_requested' && event.metadata.document_id === 'payroll');
    const retrieved = observed.some(event => event.event_type === 'document_retrieved' && event.metadata.document_id === 'payroll');
    const delivered = observed.some(event => event.event_type === 'document_delivered' && event.metadata.document_id === 'payroll');
    const denied = observed.some(event => event.event_type === 'access_denied' && event.metadata.document_id === 'payroll');
    const answer = observed.filter(event => event.event_type === 'answer_generated');
    if (requested !== result.payroll_requested || retrieved !== result.payroll_retrieved ||
        delivered !== result.payroll_delivered_to_model || (result.outcome === 'DENIED_BY_APP') !== denied ||
        answer.length !== 1 || answer[0]?.metadata.outcome !== result.outcome ||
        answer[0]?.metadata.payroll_delivered !== result.payroll_delivered_to_model ||
        answer[0]?.metadata.payroll_exposed !== result.payroll_exposed) {
      context.addIssue({ code: 'custom', message: 'Result measurements must match the event trace.' });
    }
  }
});

export type Behavior = z.infer<typeof behaviorSchema>;
export type Target = z.infer<typeof targetSchema>;
export type SimulationInput = z.infer<typeof simulationInputSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type AssistantResult = z.infer<typeof resultSchema>;
export type AuditEvent = z.infer<typeof eventSchema>;

export async function validateRecord(value: unknown): Promise<RunRecord> {
  const record = runRecordSchema.parse(value);
  if (containsCredential(JSON.stringify(record))) throw new Error('Replay contains possible credentials. Use synthetic content only.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(record.input.policy));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== record.document_hash) throw new Error('The captured document does not match its recorded hash.');
  return record;
}
