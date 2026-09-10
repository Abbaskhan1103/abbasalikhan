/**
 * CRM / AUDIENCE CAPTURE - THE CONTRACT
 * =====================================
 * One small interface that every provider adapter implements. Swapping HubSpot
 * for Buttondown is a change to one environment variable, not a change to any
 * calling code.
 *
 * Everything in this folder is written against web-standard `fetch`, `Request`
 * and `Response`, with no Node built-ins, so the same code runs unchanged on a
 * Cloudflare Pages Function, a Netlify Function or a Vercel function.
 */

/** Environment variables, as handed over by whichever host is running us. */
export type Env = Record<string, string | undefined>;

/** One captured person. The only required field is an email address. */
export interface Lead {
  email: string;
  name?: string;

  /**
   * Where this signup came from. This is the field that makes the whole thing
   * reusable: a newsletter box, a lead form and a per-post subscribe box all
   * hit the same endpoint and are told apart by their source.
   *
   * Convention: `newsletter`, `contact`, `blog:<post-slug>`, `project:<slug>`.
   */
  source: string;

  /** Extra provider-specific fields, passed through untouched. */
  fields?: Record<string, string>;

  /** The page the form was submitted from, for attribution. */
  pageUrl?: string;

  /** ISO 8601, stamped by the handler rather than the browser. */
  submittedAt: string;
}

/**
 * The result of trying to store a lead.
 *
 * `already` is a success, not a failure: someone re-subscribing has done nothing
 * wrong and must not be shown an error. Every adapter is required to map its
 * provider's "duplicate" response onto it.
 */
export type SubmitOutcome =
  | { ok: true; status: 'subscribed' | 'pending' | 'already' }
  | {
      ok: false;
      status: 'invalid' | 'rejected' | 'rate_limited' | 'provider_error' | 'not_configured';
      /** Safe to show a visitor. Never include provider internals or keys. */
      message: string;
      /** Whether retrying the same request later might succeed. */
      retryable: boolean;
      /** Server-side only, for logs. Never sent to the browser. */
      detail?: string;
    };

export interface CrmAdapter {
  /** Matches the value of the CRM_PROVIDER environment variable. */
  readonly id: string;

  /** Human-readable, used in error messages and the health endpoint. */
  readonly label: string;

  /**
   * Environment variables this adapter cannot work without. The resolver checks
   * these before any request is made, so a misconfigured deploy fails loudly at
   * the first submission rather than silently dropping leads.
   */
  readonly requiredEnv: readonly string[];

  submit(lead: Lead, env: Env): Promise<SubmitOutcome>;
}

/** Helper so adapters can return a provider failure without leaking specifics. */
export function providerError(detail: string, retryable = true): SubmitOutcome {
  return {
    ok: false,
    status: 'provider_error',
    message: 'That did not go through. Please try again in a moment.',
    retryable,
    detail,
  };
}
