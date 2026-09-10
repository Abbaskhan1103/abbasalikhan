import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * Buttondown.
 *
 * The auth scheme word is literally `Token`, not `Bearer`.
 *
 * There is no top-level `name` field, and the input schema refuses unknown keys
 * outright, so sending one is a 422 rather than being ignored. A name goes in
 * `metadata`. `source` on the response object is read-only and server-assigned,
 * so the signup's origin travels in `metadata` and `tags` instead.
 *
 * A duplicate is a hard 400 by design: Buttondown refuses rather than overwrite
 * an existing subscriber's history. The body carries a machine-readable `code`,
 * and both of the schema's duplicate codes are accepted here because the docs
 * declare both and do not pin down which one this endpoint returns.
 */
const DUPLICATE_CODES = new Set(['email_already_exists', 'subscriber_already_exists']);

export const buttondownAdapter: CrmAdapter = {
  id: 'buttondown',
  label: 'Buttondown',
  requiredEnv: ['BUTTONDOWN_API_KEY'],

  async submit(lead: Lead, env: Env) {
    const key = env.BUTTONDOWN_API_KEY;
    if (!key) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'BUTTONDOWN_API_KEY is unset',
      } as const;
    }

    const metadata: Record<string, string> = { source: lead.source };
    if (lead.name) metadata.name = lead.name;

    const body: Record<string, unknown> = {
      email_address: lead.email,
      type: 'regular',
      metadata,
      tags: [lead.source],
    };
    if (lead.pageUrl) body.referrer_url = lead.pageUrl;

    let response: Response;
    try {
      response = await fetch('https://api.buttondown.com/v1/subscribers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Token ${key}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return providerError(`buttondown fetch failed: ${String(error)}`);
    }

    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    const problem = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };

    if (response.status === 400 && problem.code && DUPLICATE_CODES.has(problem.code)) {
      return { ok: true, status: 'already' } as const;
    }
    if (response.status === 400) {
      return {
        ok: false,
        status: 'invalid',
        message: 'That email address was not accepted.',
        retryable: false,
        detail: `buttondown: ${problem.code ?? ''} ${problem.detail ?? ''}`.slice(0, 300),
      } as const;
    }
    // 403 with code `feature_disabled` means tags need a paid plan.
    return providerError(
      `buttondown responded ${response.status}: ${problem.code ?? ''}`,
      response.status >= 500,
    );
  },
};
