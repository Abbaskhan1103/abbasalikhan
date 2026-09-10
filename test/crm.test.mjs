/**
 * Tests for the signup endpoint. Run with `npm test`.
 *
 * These exercise the real handler through real Request objects, so what is
 * tested is what the deployed function runs. No provider is contacted: the
 * default "none" adapter is used everywhere except the one test that checks a
 * misconfigured provider is refused.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleSubscribe, HONEYPOT_FIELD, TIMESTAMP_FIELD, isPlausibleEmail, resolveAdapter, ADAPTERS } from '../src/lib/crm/index.ts';

const ORIGIN = 'https://abbasalikhan.com';
const URL_ = `${ORIGIN}/api/subscribe`;
// Older than the two-second minimum fill time, so it reads as human.
const HUMAN_TS = () => String(Date.now() - 5000);

const post = (body, { origin = ORIGIN, json = true, headers = {} } = {}) =>
  new Request(URL_, {
    method: 'POST',
    headers: {
      'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded',
      accept: json ? 'application/json' : 'text/html',
      origin,
      ...headers,
    },
    body: json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });

test('accepts a plain, well-formed signup', async () => {
  const res = await handleSubscribe(
    post({ email: 'Ada@Example.com ', source: 'newsletter', [TIMESTAMP_FIELD]: HUMAN_TS() }),
    { CRM_PROVIDER: 'none' },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: 'subscribed' });
});

test('normalises the address before it reaches a provider', async () => {
  let seen;
  const spy = { id: 'spy', label: 'spy', requiredEnv: [], async submit(lead) { seen = lead; return { ok: true, status: 'subscribed' }; } };
  ADAPTERS.spy = spy;
  await handleSubscribe(
    post({ email: '  Ada@EXAMPLE.com  ', source: 'newsletter', [TIMESTAMP_FIELD]: HUMAN_TS() }),
    { CRM_PROVIDER: 'spy' },
  );
  assert.equal(seen.email, 'ada@example.com');
  assert.equal(seen.source, 'newsletter');
  assert.ok(seen.submittedAt, 'the handler stamps the time, not the browser');
  delete ADAPTERS.spy;
});

test('rejects anything but POST', async () => {
  const res = await handleSubscribe(new Request(URL_, { method: 'GET' }), {});
  assert.equal(res.status, 405);
});

test('rejects a cross-origin post', async () => {
  const res = await handleSubscribe(
    post({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }, { origin: 'https://evil.example' }),
    { CRM_PROVIDER: 'none' },
  );
  assert.equal(res.status, 403);
});

test('allows a post with no Origin header, which privacy tools strip', async () => {
  const req = new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }),
  });
  const res = await handleSubscribe(req, { CRM_PROVIDER: 'none' });
  assert.equal(res.status, 200);
});

test('a filled honeypot is discarded, and told nothing about it', async () => {
  let called = false;
  ADAPTERS.spy2 = { id: 'spy2', label: 'spy2', requiredEnv: [], async submit() { called = true; return { ok: true, status: 'subscribed' }; } };
  const res = await handleSubscribe(
    post({ email: 'bot@example.com', [HONEYPOT_FIELD]: 'https://spam.example', [TIMESTAMP_FIELD]: HUMAN_TS() }),
    { CRM_PROVIDER: 'spy2' },
  );
  assert.equal(res.status, 200, 'a bot must not learn it was caught');
  assert.deepEqual(await res.json(), { ok: true, status: 'subscribed' });
  assert.equal(called, false, 'but the provider is never contacted');
  delete ADAPTERS.spy2;
});

test('a form completed instantly is discarded', async () => {
  let called = false;
  ADAPTERS.spy3 = { id: 'spy3', label: 'spy3', requiredEnv: [], async submit() { called = true; return { ok: true, status: 'subscribed' }; } };
  const res = await handleSubscribe(
    post({ email: 'bot@example.com', [TIMESTAMP_FIELD]: String(Date.now()) }),
    { CRM_PROVIDER: 'spy3' },
  );
  assert.equal(res.status, 200);
  assert.equal(called, false);
  delete ADAPTERS.spy3;
});

test('a submission with no timestamp still goes through', async () => {
  const res = await handleSubscribe(post({ email: 'ada@example.com' }), { CRM_PROVIDER: 'none' });
  assert.equal(res.status, 200);
});

test('rejects a malformed address', async () => {
  for (const email of ['', 'ada', 'ada@', '@example.com', 'a b@example.com', 'ada@@example.com', 'ada@example']) {
    const res = await handleSubscribe(post({ email, [TIMESTAMP_FIELD]: HUMAN_TS() }), { CRM_PROVIDER: 'none' });
    assert.equal(res.status, 400, `expected ${JSON.stringify(email)} to be refused`);
    assert.equal((await res.json()).status, 'invalid');
  }
});

test('accepts the awkward but legal addresses', () => {
  for (const email of ['ada+news@example.co.uk', "o'hara@example.com", 'a@b.io', 'first.last@sub.domain.example']) {
    assert.equal(isPlausibleEmail(email), true, `${email} should be accepted`);
  }
});

test('refuses to run with a provider that is missing its configuration', async () => {
  const res = await handleSubscribe(
    post({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }),
    { CRM_PROVIDER: 'buttondown' },
  );
  assert.equal(res.status, 503, 'a misconfigured deploy must not look like a working one');
  const body = await res.json();
  assert.equal(body.status, 'not_configured');
  assert.ok(!JSON.stringify(body).includes('BUTTONDOWN'), 'and must not name the missing variable to the browser');
});

test('an unknown provider falls back to none rather than dropping the lead silently', () => {
  assert.equal(resolveAdapter({ CRM_PROVIDER: 'nope' }).id, 'none');
  assert.equal(resolveAdapter({}).id, 'none');
});

test('never leaks provider internals to the browser', async () => {
  ADAPTERS.spy4 = {
    id: 'spy4', label: 'spy4', requiredEnv: [],
    async submit() {
      return { ok: false, status: 'provider_error', message: 'That did not go through.', retryable: true, detail: 'SECRET_KEY=abc123 leaked from upstream' };
    },
  };
  const res = await handleSubscribe(post({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }), { CRM_PROVIDER: 'spy4' });
  const text = await res.text();
  assert.ok(!text.includes('SECRET_KEY'), 'detail is server-side only');
  assert.ok(!text.includes('abc123'));
  delete ADAPTERS.spy4;
});

test('a thrown adapter becomes a clean error, not a crash', async () => {
  ADAPTERS.spy5 = { id: 'spy5', label: 'spy5', requiredEnv: [], async submit() { throw new Error('boom'); } };
  const res = await handleSubscribe(post({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }), { CRM_PROVIDER: 'spy5' });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).status, 'provider_error');
  delete ADAPTERS.spy5;
});

test('a form post redirects instead of returning JSON', async () => {
  const res = await handleSubscribe(
    post({ email: 'ada@example.com', [TIMESTAMP_FIELD]: HUMAN_TS() }, { json: false }),
    { CRM_PROVIDER: 'none' },
    { successPath: '/thanks/' },
  );
  assert.equal(res.status, 303, '303 so a refresh does not resubmit');
  assert.equal(res.headers.get('location'), `${ORIGIN}/thanks/`);
});

test('every registered adapter satisfies the contract', () => {
  for (const [id, adapter] of Object.entries(ADAPTERS)) {
    assert.equal(adapter.id, id, `${id}: id must match its key`);
    assert.equal(typeof adapter.label, 'string');
    assert.ok(Array.isArray(adapter.requiredEnv));
    assert.equal(typeof adapter.submit, 'function');
  }
});

test('every adapter refuses cleanly when its configuration is absent', async () => {
  for (const [id, adapter] of Object.entries(ADAPTERS)) {
    if (adapter.requiredEnv.length === 0) continue;
    const outcome = await adapter.submit(
      { email: 'ada@example.com', source: 'test', submittedAt: new Date(0).toISOString() },
      {},
    );
    assert.equal(outcome.ok, false, `${id} should refuse without configuration`);
    assert.equal(outcome.status, 'not_configured', `${id} should say so explicitly`);
  }
});
