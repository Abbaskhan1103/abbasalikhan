import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * Posts the lead as JSON to any URL you control.
 *
 * This is the escape hatch, and for most people it is the right answer: point it
 * at Zapier, Make, n8n, a Google Apps Script, or your own API, and route the
 * lead wherever you like without this repo ever knowing about that provider.
 *
 * When CRM_WEBHOOK_SECRET is set, the body is signed with HMAC-SHA256 and the
 * hex digest is sent as `X-Signature-256: sha256=...`, so the receiver can
 * verify the request really came from here. Verify it by recomputing the digest
 * over the raw body and comparing in constant time.
 */

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const webhookAdapter: CrmAdapter = {
  id: 'webhook',
  label: 'Generic webhook',
  requiredEnv: ['CRM_WEBHOOK_URL'],

  async submit(lead: Lead, env: Env) {
    const url = env.CRM_WEBHOOK_URL;
    if (!url) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'CRM_WEBHOOK_URL is unset',
      } as const;
    }

    const body = JSON.stringify(lead);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (env.CRM_WEBHOOK_SECRET) {
      headers['x-signature-256'] = `sha256=${await sign(env.CRM_WEBHOOK_SECRET, body)}`;
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body });
    } catch (error) {
      return providerError(`webhook fetch failed: ${String(error)}`);
    }

    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    // 4xx from your own webhook is a configuration problem, not a transient one.
    const retryable = response.status >= 500 || response.status === 429;
    return providerError(`webhook responded ${response.status}`, retryable);
  },
};
