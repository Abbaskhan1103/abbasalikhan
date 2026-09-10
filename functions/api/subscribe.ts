import { handleSubscribe } from '../../src/lib/crm/index.ts';

/**
 * Cloudflare Pages Function: POST /api/subscribe
 *
 * This file is NOT part of the Astro build. Astro only ever looks at src/pages
 * and public, so a top-level functions/ directory is invisible to it: the site
 * stays pure static output with no SSR adapter, and Cloudflare bundles this into
 * a separate worker that sits in front of dist/. Requests that match no function
 * fall through to the static assets exactly as they do today.
 *
 * All the real logic lives in src/lib/crm so that Netlify and Vercel shims can
 * reuse it verbatim. See README, "Capturing signups".
 *
 * `onRequestPost` rather than `onRequest`: a GET from a crawler should never
 * reach a provider.
 */

/** Minimal local shape of the Pages Function context. */
interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export const onRequestPost = async (context: PagesContext): Promise<Response> =>
  handleSubscribe(context.request, context.env, { successPath: '/thanks/' });

/** Anything other than POST is answered here rather than falling through. */
export const onRequest = async (context: PagesContext): Promise<Response> =>
  new Response(JSON.stringify({ ok: false, status: 'rejected', message: 'Use POST.' }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
  });
