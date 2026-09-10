import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * Resend contacts.
 *
 * Three things here are not obvious and all three come from the current spec:
 *
 * 1. The endpoint is POST /contacts. The audience-scoped path everybody still
 *    quotes, /audiences/{id}/contacts, has been removed, and the `audience_id`
 *    body field is marked deprecated.
 *
 * 2. A User-Agent header is mandatory. Requests without one are blocked at the
 *    edge with a 403 before they reach the API, which looks exactly like a bad
 *    API key. Some server runtimes do not set one.
 *
 * 3. Field names are snake_case in the REST API, even though the Node SDK is
 *    camelCase.
 *
 * Create behaves as an upsert with no duplicate signal at all, so this never
 * reports `already`. It also deliberately omits `unsubscribed` and any empty
 * name: sending either would overwrite real data, and `"unsubscribed": false`
 * would resurrect somebody who had opted out.
 */
export const resendAdapter: CrmAdapter = {
  id: 'resend',
  label: 'Resend',
  requiredEnv: ['RESEND_API_KEY'],

  async submit(lead: Lead, env: Env) {
    const key = env.RESEND_API_KEY;
    if (!key) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'RESEND_API_KEY is unset',
      } as const;
    }

    const body: Record<string, unknown> = { email: lead.email };
    if (lead.name) body.first_name = lead.name;
    if (env.RESEND_AUDIENCE_ID) body.audience_id = env.RESEND_AUDIENCE_ID;

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
          // Mandatory. Without it the edge returns 403 before the API is reached.
          'user-agent': 'abbasalikhan.com/1.0',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return providerError(`resend fetch failed: ${String(error)}`);
    }

    // The spec says 201, the overview page says 200. Accept any 2xx rather than
    // picking a side and failing silently when the other one shows up.
    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    const problem = (await response.json().catch(() => ({}))) as { name?: string; message?: string };

    if (response.status === 401 || response.status === 403) {
      return providerError(
        `resend rejected the key (${response.status}: ${problem.name ?? ''}). A "sending access" key is not enough; the key needs full access, and a User-Agent header is required.`,
        false,
      );
    }
    if (response.status === 422 || response.status === 400) {
      return {
        ok: false,
        status: 'invalid',
        message: 'That email address was not accepted.',
        retryable: false,
        detail: `resend: ${problem.name ?? ''} ${problem.message ?? ''}`.slice(0, 300),
      } as const;
    }
    return providerError(`resend responded ${response.status}: ${problem.name ?? ''}`);
  },
};
