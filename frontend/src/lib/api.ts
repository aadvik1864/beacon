import { validateRecord, type RunRecord, type SimulationInput } from './experiment';

export interface ApiHealth {
  status: 'ok';
  product: 'Beacon';
  version: string;
  stage: 'local-simulation';
  aws_enabled: false;
  paid_inference_enabled: false;
}

export async function getApiHealth(signal: AbortSignal): Promise<ApiHealth> {
  const response = await fetch('/api/health', { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Local API did not return a successful response.');
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' || data === null ||
    !('status' in data) || data.status !== 'ok' ||
    !('product' in data) || data.product !== 'Beacon' ||
    !('stage' in data) || data.stage !== 'local-simulation' ||
    !('version' in data) || typeof data.version !== 'string' ||
    !('aws_enabled' in data) || data.aws_enabled !== false ||
    !('paid_inference_enabled' in data) || data.paid_inference_enabled !== false
  ) throw new Error('Unexpected API configuration. Cloud execution remains unavailable.');
  return data as ApiHealth;
}

let sessionToken: string | null = null;

export async function runSimulation(input: SimulationInput, signal: AbortSignal): Promise<RunRecord> {
  if (!sessionToken) {
    const session = await fetch('/api/session', { signal, cache: 'no-store', credentials: 'omit' });
    if (!session.ok) throw new Error('Start the local Beacon API before running a simulation.');
    const data = await session.json();
    if (typeof data.token !== 'string' || data.token.length < 20 || data.token.length > 128) {
      throw new Error('The local API returned an invalid session.');
    }
    sessionToken = data.token;
  }
  const token = sessionToken;
  if (!token) throw new Error('Could not establish a local session.');
  const response = await fetch('/api/simulations', {
    method: 'POST', signal, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Beacon-Token': token },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 403) sessionToken = null;
    if (response.status === 403) throw new Error('Local session expired. Run again to establish a new session.');
    if (response.status === 429) throw new Error('The local API is busy or rate-limited. Wait a minute and try again.');
    if (response.status === 409) throw new Error('This request identifier was already used. Start a new run.');
    if (response.status === 422 || response.status === 413) throw new Error('The API rejected the input. Check document and question limits.');
    throw new Error('The local simulation could not complete. Check the Beacon API terminal.');
  }
  try {
    return await validateRecord(await response.json());
  } catch {
    throw new Error('The API returned an invalid simulation record. No new result was accepted. Check that the Beacon frontend and API versions match.');
  }
}
