/**
 * Input handling for the capture endpoint: parsing, validation and the cheap
 * bot defences that do not need a database.
 */

import type { Lead } from './types.ts';

/** The hidden field a human never fills in and a naive bot always does. */
export const HONEYPOT_FIELD = 'company_website';

/** The hidden timestamp field used to reject instantaneous submissions. */
export const TIMESTAMP_FIELD = 'rendered_at';

/** A form completed faster than this was not completed by a person. */
const MIN_FILL_MS = 2_000;

/** A form left open longer than this is stale; the page has likely been cached. */
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

export type ParseResult =
  | { ok: true; lead: Lead; wantsJson: boolean }
  | { ok: false; reason: 'unsupported_media_type' | 'malformed' | 'invalid_email' | 'honeypot' | 'too_fast' | 'stale' | 'too_large'; wantsJson: boolean };

/**
 * Deliberately permissive. The only address worth rejecting outright is one that
 * cannot possibly be delivered to, because every stricter rule invented for
 * email eventually rejects somebody's real address.
 */
export function isPlausibleEmail(value: string): boolean {
  if (value.length < 3 || value.length > 254) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length === 0 || local.length > 64) return false;
  if (domain.length < 3 || !domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (/\s/.test(value)) return false;
  return true;
}

/** Lowercases and trims. Does not strip plus-addressing: that is the user's business. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Reads a submission from either a JSON body or a normal form post, so the form
 * works identically with and without JavaScript.
 */
export async function parseSubmission(request: Request, now: number): Promise<ParseResult> {
  const accept = request.headers.get('accept') ?? '';
  const contentType = request.headers.get('content-type') ?? '';
  const wantsJson = accept.includes('application/json') || contentType.includes('application/json');

  // Refuse anything implausibly large before reading it into memory.
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > 8_192) return { ok: false, reason: 'too_large', wantsJson };

  let data: Record<string, unknown>;
  try {
    if (contentType.includes('application/json')) {
      data = (await request.json()) as Record<string, unknown>;
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      data = Object.fromEntries(await request.formData());
    } else {
      return { ok: false, reason: 'unsupported_media_type', wantsJson };
    }
  } catch {
    return { ok: false, reason: 'malformed', wantsJson };
  }

  // A filled honeypot is a bot. Answer as though it worked; do not educate it.
  if (clean(data[HONEYPOT_FIELD], 200) !== undefined) {
    return { ok: false, reason: 'honeypot', wantsJson };
  }

  // Timing. Absent or unparseable is tolerated, because a cached page or a
  // privacy tool may strip it and a real person should not be punished for that.
  const rendered = Number(data[TIMESTAMP_FIELD]);
  if (Number.isFinite(rendered) && rendered > 0) {
    const elapsed = now - rendered;
    if (elapsed < MIN_FILL_MS) return { ok: false, reason: 'too_fast', wantsJson };
    if (elapsed > MAX_FILL_MS) return { ok: false, reason: 'stale', wantsJson };
  }

  const rawEmail = clean(data.email, 254);
  if (!rawEmail) return { ok: false, reason: 'invalid_email', wantsJson };
  const email = normaliseEmail(rawEmail);
  if (!isPlausibleEmail(email)) return { ok: false, reason: 'invalid_email', wantsJson };

  return {
    ok: true,
    wantsJson,
    lead: {
      email,
      name: clean(data.name, 120),
      source: clean(data.source, 80) ?? 'unknown',
      pageUrl: clean(data.pageUrl, 500),
      submittedAt: new Date(now).toISOString(),
    },
  };
}
