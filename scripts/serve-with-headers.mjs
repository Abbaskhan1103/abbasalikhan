#!/usr/bin/env node
/**
 * Serves dist/ with the real headers from public/_headers applied.
 *
 * Why this exists: `astro preview` ignores _headers entirely, because _headers
 * is a Cloudflare/Netlify feature rather than an Astro one. That means the
 * Content-Security-Policy is never exercised locally, and a page can pass every
 * local check and still be broken in production.
 *
 * That is not hypothetical. It shipped: 81 inline `style="..."` attributes were
 * blocked live, because a style ATTRIBUTE is governed by style-src-attr, which
 * hashes do not cover. Locally everything looked correct.
 *
 * Run with `npm run preview:real` and point the audits at it.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 4322);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Parses the Cloudflare _headers format: a path pattern on a flush line,
 * followed by indented `Name: value` lines. Comments and blanks are skipped.
 */
async function parseHeaders() {
  let raw;
  try {
    raw = await readFile(join(DIST, '_headers'), 'utf8');
  } catch {
    console.warn('No dist/_headers found. Run `npm run build` first.');
    return [];
  }
  const rules = [];
  let current = null;
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const at = line.indexOf(':');
      if (at > 0) current.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return rules;
}

/** Cloudflare patterns use `*` as a wildcard; everything else is literal. */
function matches(pattern, pathname) {
  const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(pathname);
}

const rules = await parseHeaders();
console.log(`Loaded ${rules.length} header rule(s) from dist/_headers.`);

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  // Resolve the way a static host does: /foo/ -> /foo/index.html
  const candidates = [
    join(DIST, pathname),
    join(DIST, pathname, 'index.html'),
    join(DIST, `${pathname}.html`),
  ];
  let file = null;
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) {
        file = candidate;
        break;
      }
    } catch {
      /* keep looking */
    }
  }

  const notFound = file === null;
  if (notFound) file = join(DIST, '404.html');

  let body;
  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' };
  for (const rule of rules) {
    if (matches(rule.pattern, pathname)) {
      for (const [name, value] of rule.headers) headers[name] = value;
    }
  }

  res.writeHead(notFound ? 404 : 200, headers);
  res.end(body);
}).listen(PORT, () => {
  console.log(`dist/ served WITH production headers on http://localhost:${PORT}`);
});
