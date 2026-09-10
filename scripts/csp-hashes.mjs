#!/usr/bin/env node
/**
 * Post-build step: tighten the Content-Security-Policy with per-element hashes.
 *
 * Why this exists
 * ---------------
 * Astro's <Font> component writes the @font-face rules into an inline <style>
 * element. An inline element is only allowed by CSP if the policy carries either
 * 'unsafe-inline' (which defeats most of the point of having a policy) or the
 * exact hash of that element's contents. This script takes the second option: it
 * reads the real built HTML, hashes every inline <style> and every executable
 * inline <script>, and writes those hashes into dist/_headers.
 *
 * The hashes therefore always match what actually shipped. Change a font, change
 * a style, rebuild, and the policy follows along on its own.
 *
 * Run automatically by `npm run build`. Never edit dist/_headers by hand: edit
 * public/_headers, which is the source this reads from.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const HEADERS_FILE = join(DIST, '_headers');

/** Recursively collect every .html file under `dir`. */
async function htmlFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const sha256 = (text) =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/**
 * Pull out the exact text content of inline <style> and <script> elements.
 * CSP hashes the bytes between the tags verbatim, so nothing here is trimmed.
 */
function collectInline(html) {
  const styles = new Set();
  const scripts = new Set();

  const styleRe = /<style(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/style>/gi;
  for (let m; (m = styleRe.exec(html)); ) styles.add(m[2]);

  const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m; (m = scriptRe.exec(html)); ) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    // External scripts are covered by 'self'; they have no inline body to hash.
    if (/\bsrc\s*=/i.test(attrs)) continue;
    // Data blocks (JSON-LD, importmap, speculationrules) are not executed as
    // script, so script-src does not gate them and they need no hash.
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && type !== 'text/javascript' && type !== 'module') continue;
    if (body.trim() === '') continue;
    scripts.add(body);
  }

  return { styles, scripts };
}

/** Insert hashes directly after the named directive's source list opener. */
function addHashes(csp, directive, hashes) {
  if (hashes.length === 0) return csp;
  const re = new RegExp(`(^|;\\s*)(${directive}\\s+)([^;]*)`, 'i');
  if (!re.test(csp)) {
    throw new Error(
      `public/_headers has no "${directive}" directive, so ${hashes.length} required ` +
        `hash(es) cannot be added. Add "${directive} 'self';" to the ` +
        `Content-Security-Policy and rebuild.`,
    );
  }
  return csp.replace(re, (_all, lead, name, sources) => {
    const existing = sources.trim();
    const missing = hashes.filter((h) => !existing.includes(h));
    return `${lead}${name}${[existing, ...missing].filter(Boolean).join(' ')}`;
  });
}

async function main() {
  try {
    await stat(HEADERS_FILE);
  } catch {
    throw new Error(
      'dist/_headers is missing. It should have been copied from public/_headers ' +
        'during the build. Run `npm run build` rather than this script on its own.',
    );
  }

  const files = await htmlFiles(DIST);
  if (files.length === 0) throw new Error('No HTML found in dist/. Build first.');

  const styles = new Set();
  const scripts = new Set();
  for (const file of files) {
    const found = collectInline(await readFile(file, 'utf8'));
    found.styles.forEach((s) => styles.add(s));
    found.scripts.forEach((s) => scripts.add(s));
  }

  const styleHashes = [...styles].map(sha256);
  const scriptHashes = [...scripts].map(sha256);

  let headers = await readFile(HEADERS_FILE, 'utf8');
  const cspLine = /^(\s*Content-Security-Policy:\s*)(.+)$/m;
  const match = headers.match(cspLine);
  if (!match) {
    throw new Error(
      'public/_headers has no Content-Security-Policy line. Restore it, then rebuild.',
    );
  }

  let csp = match[2];
  csp = addHashes(csp, 'style-src', styleHashes);
  csp = addHashes(csp, 'script-src', scriptHashes);
  headers = headers.replace(cspLine, `$1${csp}`);

  await writeFile(HEADERS_FILE, headers, 'utf8');

  const unsafe = /'unsafe-inline'|'unsafe-eval'/.exec(csp);
  console.log(
    `CSP: hashed ${styleHashes.length} inline style(s) and ${scriptHashes.length} ` +
      `inline script(s) across ${files.length} page(s) into ${relative(ROOT, HEADERS_FILE)}.`,
  );
  if (unsafe) {
    console.warn(`CSP warning: policy still contains ${unsafe[0]}.`);
  } else {
    console.log("CSP: no 'unsafe-inline' or 'unsafe-eval' in the shipped policy.");
  }
}

main().catch((error) => {
  console.error(`\ncsp-hashes failed: ${error.message}\n`);
  process.exitCode = 1;
});
