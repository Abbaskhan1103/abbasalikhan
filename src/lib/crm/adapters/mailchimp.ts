import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * Mailchimp, via an upsert on the audience member.
 *
 * Two things here are deliberate and both matter.
 *
 * 1. PUT to the member resource, not POST to the collection. POST returns a hard
 *    400 "Member Exists" for anyone who has subscribed before, which is the most
 *    common real interaction. The PUT is an upsert and returns a clean 200.
 *
 * 2. `status_if_new` is sent and `status` is NOT. On a PUT, `status` overwrites
 *    the existing subscription state, which would silently resurrect somebody
 *    who had unsubscribed. `status_if_new` only applies to addresses that are
 *    not already on the list.
 *
 * The member is addressed by email rather than by the MD5 hash the docs lead
 * with: the endpoint accepts either, and Web Crypto cannot do MD5, so hashing
 * would mean shipping an MD5 implementation for no benefit.
 */
export const mailchimpAdapter: CrmAdapter = {
  id: 'mailchimp',
  label: 'Mailchimp',
  requiredEnv: ['MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER_PREFIX', 'MAILCHIMP_AUDIENCE_ID'],

  async submit(lead: Lead, env: Env) {
    const key = env.MAILCHIMP_API_KEY;
    const dc = env.MAILCHIMP_SERVER_PREFIX;
    const list = env.MAILCHIMP_AUDIENCE_ID;
    if (!key || !dc || !list) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX or MAILCHIMP_AUDIENCE_ID is unset',
      } as const;
    }

    const body: Record<string, unknown> = {
      email_address: lead.email,
      // "pending" sends Mailchimp's confirmation email (double opt-in).
      // Change to "subscribed" only if the audience is set to single opt-in.
      status_if_new: 'pending',
      email_type: 'html',
    };
    if (lead.name) body.merge_fields = { FNAME: lead.name };

    const url = `https://${encodeURIComponent(dc)}.api.mailchimp.com/3.0/lists/${encodeURIComponent(list)}/members/${encodeURIComponent(lead.email)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return providerError(`mailchimp fetch failed: ${String(error)}`);
    }

    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    const problem = (await response.json().catch(() => ({}))) as { title?: string; detail?: string };

    // Someone who unsubscribed or hard-bounced cannot be re-added by API, and
    // should not be. From the visitor's side this is simply "already handled".
    if (problem.title === 'Member In Compliance State') {
      return { ok: true, status: 'already' } as const;
    }
    if (problem.title === 'Member Exists') {
      return { ok: true, status: 'already' } as const;
    }
    if (response.status === 400) {
      return {
        ok: false,
        status: 'invalid',
        message: 'That email address was not accepted.',
        retryable: false,
        detail: `mailchimp: ${problem.title ?? ''} ${problem.detail ?? ''}`.slice(0, 300),
      } as const;
    }
    return providerError(`mailchimp responded ${response.status}: ${problem.title ?? ''}`);
  },
};
