import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * Loops.
 *
 * PUT /v1/contacts/update, not POST /v1/contacts/create. The create endpoint
 * returns 409 for anybody who has signed up before; the update endpoint is an
 * upsert and returns a plain 200 either way, which makes the returning-visitor
 * case the happy path instead of an exception to handle.
 *
 * The response is byte-identical whether a contact was created or updated, so
 * this never reports `already`. Finding out would mean a second request to
 * GET /v1/contacts/find, which is not worth it to change one word of copy.
 *
 * Loops does not permit cross-origin calls from a browser at all, so this has to
 * be server-side regardless of key secrecy.
 */
export const loopsAdapter: CrmAdapter = {
  id: 'loops',
  label: 'Loops',
  requiredEnv: ['LOOPS_API_KEY'],

  async submit(lead: Lead, env: Env) {
    const key = env.LOOPS_API_KEY;
    if (!key) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'LOOPS_API_KEY is unset',
      } as const;
    }

    const body: Record<string, unknown> = { email: lead.email, source: lead.source };
    if (lead.name) body.firstName = lead.name;
    if (env.LOOPS_MAILING_LIST_ID) {
      body.mailingLists = { [env.LOOPS_MAILING_LIST_ID]: true };
    }

    let response: Response;
    try {
      response = await fetch('https://app.loops.so/api/v1/contacts/update', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return providerError(`loops fetch failed: ${String(error)}`);
    }

    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    const problem = (await response.json().catch(() => ({}))) as { message?: string };

    // Only reachable if someone switches this to the create endpoint.
    if (response.status === 409) return { ok: true, status: 'already' } as const;

    if (response.status === 400) {
      return {
        ok: false,
        status: 'invalid',
        message: 'That email address was not accepted.',
        retryable: false,
        detail: `loops: ${problem.message ?? ''}`.slice(0, 300),
      } as const;
    }
    return providerError(`loops responded ${response.status}: ${problem.message ?? ''}`);
  },
};
