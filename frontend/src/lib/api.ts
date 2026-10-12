import { validateRecord, type RunRecord, type SimulationInput } from './experiment';

export interface ApiHealth {
  status: 'ok';
  product: 'Beacon';
  version: string;
  stage: 'local-simulation';
  aws_enabled: false;
  paid_inference_enabled: false;
  access_mode?: 'local' | 'sso';
}

export async function getApiHealth(signal: AbortSignal): Promise<ApiHealth> {
  const response = await fetch('/api/health', { signal, cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (response.status === 401) throw new Error('Sign-in expired. Reload this page to sign in.');
  if (!response.ok) throw new Error('Local API did not return a successful response.');
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' || data === null ||
    !('status' in data) || data.status !== 'ok' ||
    !('product' in data) || data.product !== 'Beacon' ||
    !('stage' in data) || data.stage !== 'local-simulation' ||
    !('version' in data) || typeof data.version !== 'string' ||
    !('aws_enabled' in data) || data.aws_enabled !== false ||
    !('paid_inference_enabled' in data) || data.paid_inference_enabled !== false ||
    ('access_mode' in data && data.access_mode !== 'local' && data.access_mode !== 'sso')
  ) throw new Error('Unexpected API configuration. Cloud execution remains unavailable.');
  return data as ApiHealth;
}

async function sessionToken(signal: AbortSignal): Promise<string> {
  // Fetch per action so an SSO account change never reuses another user's token.
  // HttpOnly SSO cookies are sent only to this origin and never read by JavaScript.
  const session = await fetch('/api/session', { signal, cache: 'no-store', credentials: 'same-origin' });
  if (session.status === 401) throw new Error('Sign-in expired. Reload this page to sign in.');
  if (!session.ok) throw new Error('Could not establish a Beacon request session. Check your access and API connection.');
  const data = await session.json();
  if (typeof data.token !== 'string' || data.token.length < 20 || data.token.length > 128) {
    throw new Error('The API returned an invalid request session.');
  }
  return data.token;
}

export async function clearApiCaptures(signal: AbortSignal): Promise<void> {
  const token = await sessionToken(signal);
  const response = await fetch('/api/captures/clear', {
    method: 'POST', signal, cache: 'no-store', credentials: 'same-origin',
    headers: { 'X-Beacon-Token': token },
  });
  if (!response.ok) throw new Error('Browser capture cleared, but API cache deletion could not be confirmed. It expires automatically.');
}

export async function runSimulation(input: SimulationInput, signal: AbortSignal): Promise<RunRecord> {
  const token = await sessionToken(signal);
  const response = await fetch('/api/simulations', {
    method: 'POST', signal, cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Beacon-Token': token },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sign-in expired. Reload this page to sign in.');
    if (response.status === 403) throw new Error('Request session expired or access denied. Reload the page and try again.');
    if (response.status === 429) throw new Error('The API is busy or rate-limited. Wait a minute and try again.');
    if (response.status === 409) throw new Error('This request identifier was already used. Start a new run.');
    if (response.status === 422 || response.status === 413) throw new Error('The API rejected the input. Check input limits and use synthetic content without credentials.');
    throw new Error('The local simulation could not complete. Check the Beacon API terminal.');
  }
  try {
    return await validateRecord(await response.json());
  } catch {
    throw new Error('The API returned an invalid simulation record. No new result was accepted. Check that the Beacon frontend and API versions match.');
  }
}
