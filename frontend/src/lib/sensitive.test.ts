import { describe, expect, it } from 'vitest';
import { containsCredential } from './sensitive';
import { simulationInputSchema } from './experiment';

describe('credential-pattern guard', () => {
  it.each(['AKIA' + 'A'.repeat(16), '-----BEGIN PRIVATE KEY-----', 'ghp_' + 'a'.repeat(36), 'https://user:password@example.com'])('rejects a known credential pattern', value => {
    expect(containsCredential(value)).toBe(true);
    expect(simulationInputSchema.safeParse({
      mode: 'simulation', idempotency_key: crypto.randomUUID(), policy: value, question: 'Leave?', behavior: 'follow', target: 'both',
    }).success).toBe(false);
  });
  it('accepts synthetic fixture names without claiming to detect all secrets', () => {
    expect(containsCredential('private/payroll.csv BEACON_SYNTHETIC_012345')).toBe(false);
  });
});
