import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigateToLogin, waitForPrivateStack } from './navigation.mjs';

test('pre-login GET recovers from a transient browser network change', async () => {
  const calls = [];
  const delays = [];
  const response = { status: () => 200 };
  const page = { goto: async (...args) => {
    calls.push(args);
    if (calls.length < 3) throw new Error('page.goto: net::ERR_NETWORK_CHANGED');
    return response;
  } };
  assert.equal(await navigateToLogin(page, 'https://localhost:38443', async ms => delays.push(ms)), response);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['https://localhost:38443', { waitUntil: 'domcontentloaded', timeout: 10000 }]);
  assert.deepEqual(delays, [300, 600]);
});

test('a persistent browser network change fails after three attempts', async () => {
  let calls = 0;
  const error = new Error('page.goto: net::ERR_NETWORK_CHANGED');
  await assert.rejects(navigateToLogin({ goto: async () => { calls++; throw error; } }, 'fixture', async () => {}), value => value === error);
  assert.equal(calls, 3);
});

for (const message of ['net::ERR_CONNECTION_REFUSED', 'net::ERR_CERT_AUTHORITY_INVALID', 'net::ERR_ABORTED', 'Timeout 10000ms exceeded']) {
  test(`pre-login GET does not retry ${message}`, async () => {
    let calls = 0;
    const error = new Error(message);
    await assert.rejects(navigateToLogin({ goto: async () => { calls++; throw error; } }, 'fixture', () => assert.fail('Unexpected retry')), value => value === error);
    assert.equal(calls, 1);
  });
}

test('HTTP authentication failures are returned unchanged, not retried', async () => {
  const response = { status: () => 403 };
  assert.equal(await navigateToLogin({ goto: async () => response }, 'fixture', () => assert.fail('Unexpected retry')), response);
});

function requestWith(statuses) {
  let calls = 0;
  let disposed = 0;
  return {
    get calls() { return calls; },
    get disposed() { return disposed; },
    get: async (url, options) => {
      assert.equal(url, 'https://localhost:38443/api/health');
      assert.deepEqual(options, { timeout: 2000, maxRedirects: 0 });
      const next = statuses[Math.min(calls++, statuses.length - 1)];
      if (next instanceof Error) throw next;
      return { status: () => next, dispose: async () => { disposed++; } };
    },
  };
}

test('readiness waits only for service unavailability and refused/reset connections', async () => {
  const request = requestWith([new Error('ECONNREFUSED'), 502, new Error('ECONNRESET'), 503, 504, 401]);
  await waitForPrivateStack(request, 'https://localhost:38443', async () => {});
  assert.equal(request.calls, 6);
  assert.equal(request.disposed, 4);
});

test('readiness has a fixed ten-attempt limit', async () => {
  const request = requestWith([503]);
  await assert.rejects(waitForPrivateStack(request, 'https://localhost:38443', async () => {}), /did not become ready/);
  assert.equal(request.calls, 10);
  assert.equal(request.disposed, 10);
});

for (const status of [200, 302, 403, 404, 500]) {
  test(`readiness fails immediately on unexpected HTTP ${status}`, async () => {
    const request = requestWith([status]);
    await assert.rejects(waitForPrivateStack(request, 'https://localhost:38443', () => assert.fail('Unexpected retry')), /Anonymous API access must be rejected/);
    assert.equal(request.calls, 1);
    assert.equal(request.disposed, 1);
  });
}

test('readiness does not hide certificate errors', async () => {
  const request = requestWith([new Error('self-signed certificate')]);
  await assert.rejects(waitForPrivateStack(request, 'https://localhost:38443', () => assert.fail('Unexpected retry')), /self-signed certificate/);
  assert.equal(request.calls, 1);
});
