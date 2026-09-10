import type { CrmAdapter, Env, Lead, SubmitOutcome } from './types.ts';
import { noneAdapter } from './adapters/none.ts';
import { webhookAdapter } from './adapters/webhook.ts';
import { hubspotAdapter } from './adapters/hubspot.ts';
import { mailchimpAdapter } from './adapters/mailchimp.ts';
import { buttondownAdapter } from './adapters/buttondown.ts';
import { resendAdapter } from './adapters/resend.ts';
import { loopsAdapter } from './adapters/loops.ts';
import { parseSubmission } from './validate.ts';

export * from './types.ts';
export { HONEYPOT_FIELD, TIMESTAMP_FIELD, isPlausibleEmail } from './validate.ts';

/**
 * Every adapter, keyed by the value CRM_PROVIDER takes.
 *
 * ADDING A PROVIDER: write one file in ./adapters implementing CrmAdapter, add
 * it here, done. Nothing else in the codebase knows which provider is in use.
 */
export const ADAPTERS: Record<string, CrmAdapter> = {
  none: noneAdapter,
  webhook: webhookAdapter,
  hubspot: hubspotAdapter,
  mailchimp: mailchimpAdapter,
  buttondown: buttondownAdapter,
  resend: resendAdapter,
  loops: loopsAdapter,
};

export function resolveAdapter(env: Env): CrmAdapter {
  const id = (env.CRM_PROVIDER ?? 'none').trim().toLowerCase();
  const adapter = ADAPTERS[id];
  if (!adapter) {
    console.error(
      `[crm] CRM_PROVIDER is "${id}", which is not a known adapter. ` +
        `Known: ${Object.keys(ADAPTERS).join(', ')}. Falling back to "none", so signups are being logged and NOT stored.`,
    );
    return noneAdapter;
  }
  return adapter;
}

/** Reports missing configuration before a request is ever sent to a provider. */
export function missingEnv(adapter: CrmAdapter, env: Env): string[] {
  return adapter.requiredEnv.filter((name) => !env[name]);
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      // This endpoint is for this site's own form. It is not a public API.
      'access-control-allow-origin': 'null',
    },
  });

export interface HandlerOptions {
  /** Where a no-JavaScript submission is sent on success. */
  successPath?: string;
  /** Overrides the same-origin check. Defaults to the request's own origin. */
  allowedOrigins?: string[];
}

/**
 * The whole endpoint, in one host-agnostic function.
 *
 * Takes and returns web-standard Request and Response, so the Cloudflare,
 * Netlify and Vercel entry points are each a two-line shim around this.
 */
export async function handleSubscribe(
  request: Request,
  env: Env,
  options: HandlerOptions = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, status: 'rejected', message: 'Use POST.' }, 405);
  }

  /**
   * Same-origin gate. The CSP already restricts form-action to 'self', but that
   * only binds browsers that honour it, so the server checks too. A missing
   * Origin header is allowed through: some privacy tools strip it, and a real
   * person should not be blocked for that.
   */
  const self = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const allowed = options.allowedOrigins ?? [self];
  if (origin && !allowed.includes(origin)) {
    return json({ ok: false, status: 'rejected', message: 'Cross-origin posts are not accepted.' }, 403);
  }

  const now = Date.now();
  const parsed = await parseSubmission(request, now);

  if (!parsed.ok) {
    /**
     * A bot gets the same answer a person does. Telling it which defence caught
     * it is free tuning advice, and there is nothing to gain from it.
     */
    if (parsed.reason === 'honeypot' || parsed.reason === 'too_fast') {
      console.warn(`[crm] discarded a submission: ${parsed.reason}`);
      return parsed.wantsJson
        ? json({ ok: true, status: 'subscribed' }, 200)
        : Response.redirect(new URL(options.successPath ?? '/thanks/', self).href, 303);
    }
    if (parsed.reason === 'invalid_email' || parsed.reason === 'stale') {
      return json({ ok: false, status: 'invalid', message: 'That email address does not look right.' }, 400);
    }
    return json({ ok: false, status: 'rejected', message: 'That submission could not be read.' }, 400);
  }

  const lead: Lead = parsed.lead;
  const adapter = resolveAdapter(env);

  const missing = missingEnv(adapter, env);
  if (missing.length > 0) {
    // Loud on the server, vague to the visitor: a misconfigured deploy must not
    // look like a working one, and must not leak which variables are unset.
    console.error(`[crm] adapter "${adapter.id}" is missing: ${missing.join(', ')}`);
    return json({ ok: false, status: 'not_configured', message: 'Signups are not available right now.' }, 503);
  }

  let outcome: SubmitOutcome;
  try {
    outcome = await adapter.submit(lead, env);
  } catch (error) {
    console.error(`[crm] adapter "${adapter.id}" threw:`, error);
    outcome = {
      ok: false,
      status: 'provider_error',
      message: 'That did not go through. Please try again in a moment.',
      retryable: true,
    };
  }

  if (!outcome.ok && outcome.detail) console.error(`[crm] ${adapter.id}: ${outcome.detail}`);

  if (!parsed.wantsJson) {
    // A plain form post. Redirect rather than render, so a refresh does not
    // resubmit. 303 forces the follow-up to be a GET.
    const target = outcome.ok
      ? new URL(options.successPath ?? '/thanks/', self)
      : new URL('/', self);
    if (!outcome.ok) target.searchParams.set('signup', outcome.status);
    return Response.redirect(target.href, 303);
  }

  // `detail` is server-side only and must never reach the browser.
  const body = outcome.ok
    ? { ok: true, status: outcome.status }
    : { ok: false, status: outcome.status, message: outcome.message };

  const code = outcome.ok ? 200 : outcome.status === 'invalid' ? 400 : outcome.status === 'not_configured' ? 503 : 502;
  return json(body, code);
}
