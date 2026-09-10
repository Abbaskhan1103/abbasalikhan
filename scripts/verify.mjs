#!/usr/bin/env node
/**
 * Checks the built site against the things that are easy to break and hard to
 * notice. Run with `npm run verify` after a build, and before any deploy.
 *
 * Every check either passes, warns, or fails. A failure exits non-zero so this
 * can sit in front of a deploy step.
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

let failures = 0;
let warnings = 0;

const pass = (m) => console.log(`  ok    ${m}`);
const warn = (m) => {
  warnings += 1;
  console.log(`  warn  ${m}`);
};
const fail = (m) => {
  failures += 1;
  console.log(`  FAIL  ${m}`);
};
const check = (ok, okMsg, failMsg) => (ok ? pass(okMsg) : fail(failMsg));
const section = (t) => console.log(`\n${t}`);

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = (await htmlFiles(DIST)).sort();
const pages = await Promise.all(
  files.map(async (file) => ({
    path: '/' + relative(DIST, file).replace(/index\.html$/, '').replace(/\.html$/, ''),
    file,
    html: await readFile(file, 'utf8'),
  })),
);

/** The home page. Still checked hardest: it is the entity home. */
const html = pages.find((p) => p.path === '/').html;
const headers = await readFile(join(DIST, '_headers'), 'utf8');
const robots = await readFile(join(DIST, 'robots.txt'), 'utf8');

const count = (re) => (html.match(re) ?? []).length;

/* ------------------------------------------------------------ document shape */
section('Document');
check(count(/<h1[\s>]/g) === 1, 'exactly one <h1>', `expected 1 <h1>, found ${count(/<h1[\s>]/g)}`);
check(count(/rel="canonical"/g) === 1, 'exactly one canonical link', 'canonical link is missing or duplicated');
check(count(/application\/ld\+json/g) === 1, 'exactly one JSON-LD block', `found ${count(/application\/ld\+json/g)} JSON-LD blocks; duplicates split the entity`);
check(/<html lang="en-AU"/.test(html), 'html lang is en-AU', 'html lang is missing or wrong');
check(/name="viewport"/.test(html), 'viewport meta present', 'viewport meta missing');

/* Tags become spaces, not nothing: the name is set in three block-level spans,
   and the browser inserts whitespace between them when computing the accessible
   name. Stripping tags outright would report "AbbasAliKhan" and cry wolf. */
const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/
  .exec(html)?.[1]
  ?.replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
check(h1 === 'Abbas Ali Khan', 'h1 is the exact name and nothing else', `h1 should be the bare name, got "${h1}"`);

/* Heading order: no level may be skipped on the way down. */
const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
let skipped = null;
for (let i = 1; i < levels.length; i += 1) {
  if (levels[i] - levels[i - 1] > 1) skipped = `h${levels[i - 1]} -> h${levels[i]}`;
}
check(!skipped, `heading order is unbroken (${levels.map((l) => 'h' + l).join(' ')})`, `heading level skipped: ${skipped}`);

/* --------------------------------------------------------------- structured */
section('Structured data');
const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
let graph = null;
try {
  graph = JSON.parse(ld.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
  pass('JSON-LD parses');
} catch (error) {
  fail(`JSON-LD does not parse: ${error.message}`);
}

if (graph) {
  const nodes = graph['@graph'] ?? [];
  const byType = (t) => nodes.filter((n) => n['@type'] === t);
  for (const type of ['Person', 'WebSite', 'ProfilePage', 'ItemList']) {
    check(byType(type).length === 1, `one ${type} node`, `expected 1 ${type} node, found ${byType(type).length}`);
  }
  const person = byType('Person')[0];
  if (person) {
    check(!!person.disambiguatingDescription, 'Person carries a disambiguatingDescription', 'no disambiguatingDescription: the name collides with two Wikipedia entities');
    check(Array.isArray(person.sameAs) && person.sameAs.length > 0, `sameAs declares ${person.sameAs?.length ?? 0} profile(s)`, 'sameAs is empty');
    check(!!person.address?.addressLocality, 'Person has a postal address', 'Person address missing');
    if (!person.image) warn('Person has no image. A portrait is close to required for a knowledge panel or an AI answer card; set identity.portrait.src.');
    else pass('Person has an image');

    /*
     * The entity-merge trap. The bare "abbasalikhan" handle belongs to a
     * different, well-known person. Claiming it as sameAs merges the two.
     */
    const risky = (person.sameAs ?? []).filter((u) =>
      /(?:instagram|facebook|twitter|x|youtube|soundcloud)\.com\/(?:user\/)?abbasalikhan\/?$/i.test(u),
    );
    check(risky.length === 0, 'no sameAs points at a bare "abbasalikhan" handle', `sameAs claims ${risky.join(', ')} — those handles belong to the musician of the same name and would merge the entities`);
  }
  const list = byType('ItemList')[0];
  if (list) {
    check(list.numberOfItems === list.itemListElement?.length, `ItemList count agrees with its items (${list.numberOfItems})`, 'ItemList numberOfItems disagrees with itemListElement length');
    const rated = (list.itemListElement ?? []).filter((i) => i.item?.aggregateRating || i.item?.review);
    check(rated.length === 0, 'no self-serving rating or review markup', 'aggregateRating/review on your own apps is a structured-data violation');
  }
}

/* --------------------------------------------------------------------- meta */
section('Meta and social');
const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '';
check(title.length > 0 && title.length <= 60, `title is ${title.length} chars`, `title is ${title.length} chars; keep it under 60`);
check(title.startsWith('Abbas Ali Khan'), 'title leads with the name', 'title should lead with the exact name');

const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
check(desc.length >= 120 && desc.length <= 165, `meta description is ${desc.length} chars`, `meta description is ${desc.length} chars; aim for 150-160`);

for (const tag of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) {
  check(html.includes(`"${tag}"`), `${tag} present`, `${tag} missing`);
}
check(/property="og:type" content="profile"/.test(html), 'og:type is profile', 'og:type should be "profile" for a person');
check(!/twitter:site" content="@abbasalikhan"/.test(html), 'twitter:site does not claim the musician\'s handle', 'twitter:site claims @abbasalikhan, which is not yours');

/* -------------------------------------------------------------------- images */
section('Images');
const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
if (imgs.length === 0) pass('no <img> elements to check');
for (const img of imgs) {
  const src = /src="([^"]*)"/.exec(img)?.[1] ?? '(no src)';
  // `alt=""` and a bare `alt` are equivalent, and the HTML compressor emits
  // the latter. Both mark the image decorative; only a missing attribute fails.
  check(/\salt(=|[\s>])/.test(img), `alt present on ${src}`, `alt missing on ${src}`);
  check(/\bwidth="/.test(img) && /\bheight="/.test(img), `intrinsic size on ${src}`, `width/height missing on ${src}, which lets it shift the layout`);
}

try {
  const og = await stat(join(DIST, 'og.png'));
  check(og.size < 400_000, `og.png is ${(og.size / 1024).toFixed(0)}KB`, `og.png is ${(og.size / 1024).toFixed(0)}KB, which is heavy for a share card`);
} catch {
  fail('og.png is missing from dist; run `npm run og`');
}

/* ------------------------------------------------------------------ security */
section('Security headers');
const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1] ?? '';
check(csp.length > 0, 'CSP present', 'no Content-Security-Policy in _headers');
check(!csp.includes("'unsafe-inline'"), "CSP has no 'unsafe-inline'", "CSP contains 'unsafe-inline'");
check(!csp.includes("'unsafe-eval'"), "CSP has no 'unsafe-eval'", "CSP contains 'unsafe-eval'");
check(/frame-ancestors 'none'/.test(csp), 'framing is denied', 'frame-ancestors is not none');
check(/object-src 'none'/.test(csp), 'object-src is none', 'object-src is not none');

/* Every inline block in the document must be covered by a hash in the policy. */
const styleHashes = (csp.match(/style-src[^;]*/)?.[0].match(/'sha256-/g) ?? []).length;
const inlineStyles = count(/<style(?![^>]*\bsrc=)/g);
check(styleHashes >= inlineStyles, `all ${inlineStyles} inline style block(s) are hashed in the CSP`, `${inlineStyles} inline style blocks but only ${styleHashes} hashes; run npm run postbuild`);

const scriptHashes = (csp.match(/script-src[^;]*/)?.[0].match(/'sha256-/g) ?? []).length;
const inlineScripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs, body]) => {
  if (/\bsrc\s*=/.test(attrs)) return false;
  const type = /\btype\s*=\s*"?([^"\s>]+)/.exec(attrs)?.[1];
  if (type && type !== 'module' && type !== 'text/javascript') return false;
  return body.trim() !== '';
}).length;
check(scriptHashes >= inlineScripts, `all ${inlineScripts} inline script block(s) are hashed in the CSP`, `${inlineScripts} inline scripts but only ${scriptHashes} hashes; run npm run postbuild`);

for (const header of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
  check(headers.includes(header), `${header} set`, `${header} missing`);
}

/* --------------------------------------------------- CSP vs what pages need */
section('CSP against actual page content');
{
  const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1] ?? '';
  const styleSrc = /style-src([^;]*)/.exec(csp)?.[1] ?? '';
  const scriptSrc = /script-src([^;]*)/.exec(csp)?.[1] ?? '';
  const styleAttrsAllowed = /'unsafe-inline'|'unsafe-hashes'/.test(styleSrc) || /style-src-attr/.test(csp);
  const handlersAllowed = /'unsafe-inline'|'unsafe-hashes'/.test(scriptSrc);

  /*
   * A style ATTRIBUTE is governed by style-src-attr, which hashes do NOT cover.
   * This shipped once: 81 of them were silently blocked in production while
   * every local check passed, because `astro preview` applies no headers.
   */
  const withAttrs = pages.filter((page) => /\sstyle="/.test(page.html));
  const attrCount = withAttrs.reduce((n, page) => n + (page.html.match(/\sstyle="/g) ?? []).length, 0);
  check(
    styleAttrsAllowed || attrCount === 0,
    'no inline style attributes, so the CSP needs no unsafe-hashes',
    `${attrCount} inline style attribute(s) across ${withAttrs.length} page(s) (${withAttrs.map((p) => p.path).join(', ')}), but style-src has neither 'unsafe-inline' nor 'unsafe-hashes'. Every one of them will be BLOCKED in production. Move them into src/styles/main.css.`,
  );

  const handlers = pages.filter((page) => /\son(click|load|error|mouseover|focus|submit|change|input)="/i.test(page.html));
  check(
    handlersAllowed || handlers.length === 0,
    'no inline event handlers',
    `inline event handler(s) on ${handlers.map((p) => p.path).join(', ')} will be blocked by script-src`,
  );

  const jsUrls = pages.filter((page) => /(href|src)="javascript:/i.test(page.html));
  check(jsUrls.length === 0, 'no javascript: URLs', `javascript: URL(s) on ${jsUrls.map((p) => p.path).join(', ')} will be blocked`);
}

/* ------------------------------------------------------------- independence */
section('Third-party independence');
const origins = [...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)]
  .map((m) => m[1].toLowerCase())
  .filter((h) => !['abbasalikhan.com', 'schema.org', 'www.schema.org', 'www.wikidata.org', 'www.w3.org'].includes(h));
const external = [...new Set(origins)].filter((h) => !h.endsWith('linkedin.com'));
check(external.length === 0, 'no third-party origins are requested by the document', `document references ${external.join(', ')}`);
check(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'fonts are self-hosted', 'the document still points at Google Fonts');

const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
const unsafeTargets = anchors.filter((a) => /target="_blank"/.test(a) && !/rel="[^"]*noopener/.test(a));
check(unsafeTargets.length === 0, 'every target="_blank" link carries rel="noopener"', `${unsafeTargets.length} link(s) open a new tab without rel="noopener"`);

/* -------------------------------------------------------------------- robots */
section('Crawling');
check(/Sitemap:\s*https:\/\/abbasalikhan\.com\/sitemap-index\.xml/.test(robots), 'robots.txt declares the sitemap', 'robots.txt does not declare the sitemap');
const blocked = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot'].filter((bot) => new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Disallow:\\s*/`, 'i').test(robots));
check(blocked.length === 0, 'no AI crawler is blocked', `robots.txt blocks ${blocked.join(', ')}, which removes you from the answer surfaces where name disambiguation happens`);
check(/max-image-preview:large/.test(html), 'robots meta allows large image previews', 'robots meta is missing max-image-preview:large');

/* --------------------------------------------------------------------- copy */
section('Copy');
const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
const words = text.trim().split(' ').filter(Boolean).length;
check(words >= 400, `${words} words of visible copy`, `only ${words} words; a thin entity home will not be treated as authoritative`);
if (words > 1400) warn(`${words} words is long for a single page with no subpages`);

const nameHits = (text.match(/Abbas Ali Khan/g) ?? []).length;
check(nameHits >= 4 && nameHits <= 12, `the full name appears ${nameHits} times in visible copy`, `the full name appears ${nameHits} times; 4-12 is the natural range and more reads as stuffing`);
const melbourne = (text.match(/Melbourne/g) ?? []).length;
check(melbourne >= 2, `"Melbourne" appears ${melbourne} times`, 'Melbourne barely appears, and it is the winnable query');

/* ------------------------------------------------------------------- weight */
section('Weight');
const gz = gzipSync(Buffer.from(html, 'utf8'), { level: 9 }).length;
check(gz < 51_200, `document is ${(gz / 1024).toFixed(1)}KB gzipped`, `document is ${(gz / 1024).toFixed(1)}KB gzipped; budget is 50KB`);
const stated = /(\d+) kB gzipped/.exec(html)?.[1];
check(stated && Math.abs(Number(stated) - Math.round(gz / 1024)) <= 1, `the colophon's stated weight (${stated}kB) matches reality`, `the colophon says ${stated}kB but the document is ${Math.round(gz / 1024)}kB`);

/* --------------------------------------------------------------- every page */
section(`Every page (${pages.length})`);
for (const page of pages) {
  const h1s = (page.html.match(/<h1[\s>]/g) ?? []).length;
  const canon = (page.html.match(/rel="canonical"/g) ?? []).length;
  const ld = (page.html.match(/application\/ld\+json/g) ?? []).length;
  const title = /<title>([\s\S]*?)<\/title>/.exec(page.html)?.[1] ?? '';
  const desc = /<meta name="description" content="([^"]*)"/.exec(page.html)?.[1] ?? '';

  const problems = [];
  if (h1s !== 1) problems.push(`${h1s} <h1>`);
  if (canon !== 1) problems.push(`${canon} canonical`);
  if (ld !== 1) problems.push(`${ld} JSON-LD blocks`);
  if (!title) problems.push('no <title>');
  if (title.length > 65) problems.push(`title ${title.length} chars`);
  if (!desc) problems.push('no meta description');
  if (/00 kB/.test(page.html)) problems.push('unstamped weight placeholder');

  // A canonical must point at the page it is on, or it hands ranking elsewhere.
  const canonHref = /<link rel="canonical" href="([^"]*)"/.exec(page.html)?.[1] ?? '';
  const expected = `https://abbasalikhan.com${page.path.endsWith('/') ? page.path : page.path + '/'}`;
  const isNoindex = /content="noindex/.test(page.html);
  if (!isNoindex && canonHref !== expected) problems.push(`canonical is ${canonHref}, expected ${expected}`);

  check(problems.length === 0, `${page.path}`, `${page.path}: ${problems.join('; ')}`);
}

/* Every JSON-LD Person node must be identical, or the entity splits in half. */
const persons = pages
  .map((page) => {
    const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page.html)?.[1];
    if (!raw) return null;
    try {
      const g = JSON.parse(raw.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
      return (g['@graph'] ?? []).find((n) => n['@type'] === 'Person') ?? null;
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const ids = [...new Set(persons.map((p) => p['@id']))];
check(ids.length === 1, `all ${persons.length} pages declare one Person @id (${ids[0]})`, `pages declare ${ids.length} different Person @ids: ${ids.join(', ')} — this splits the entity`);
const shapes = [...new Set(persons.map((p) => JSON.stringify(p)))];
check(shapes.length === 1, 'the Person node is identical on every page', `${shapes.length} different Person nodes across pages; they must match exactly`);

/* Internal links must resolve to something that was actually built. */
const built = new Set(pages.map((p) => (p.path.endsWith('/') ? p.path : p.path + '/')));
const broken = [];
for (const page of pages) {
  for (const m of page.html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1].endsWith('/') ? m[1] : m[1] + '/';
    if (/\.(png|svg|xml|txt|json|webmanifest|ico|woff2?|jpe?g|avif|webp)\/$/.test(href)) continue;
    if (href.startsWith('/_astro/')) continue;
    if (!built.has(href)) broken.push(`${page.path} -> ${m[1]}`);
  }
}
check(broken.length === 0, 'every internal link resolves to a built page', `broken internal links: ${[...new Set(broken)].join(', ')}`);

/* -------------------------------------------------------------------- result */
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s), ${warnings} warning(s).`);
if (failures > 0) process.exitCode = 1;
