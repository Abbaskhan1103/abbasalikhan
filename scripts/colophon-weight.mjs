#!/usr/bin/env node
/**
 * Post-build step: write the page's real compressed weight into its colophon.
 *
 * The colophon states the page's own size, which makes it the one line on the
 * site that can quietly become a lie every time the content changes. So it is
 * measured rather than typed: this replaces the `00 kB` placeholder rendered by
 * index.astro with the actual gzipped size of the built document.
 *
 * Because writing the number changes the file, and changing the file changes its
 * compressed size, the measurement is iterated until it agrees with itself.
 * Rounding to whole kilobytes means that converges immediately in practice.
 *
 * Run automatically by `npm run build`.
 */

import { gzipSync } from 'node:zlib';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const MAX_PASSES = 6;

/** Matches the placeholder, or a figure this script wrote on a previous run. */
const FIGURE = /\b\d+ kB gzipped\b|\b00 kB\b/;

const kb = (bytes) => Math.round(bytes / 1024);

/** Every .html file under dist, recursively. */
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

/** Measures one page and writes its own weight into its own colophon. */
async function stamp(file) {
  let html = await readFile(file, 'utf8');
  if (!FIGURE.test(html)) return null;

  let settled = null;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const size = kb(gzipSync(Buffer.from(html, 'utf8'), { level: 9 }).length);
    const label = `${size} kB gzipped`;
    const next = html.replace(FIGURE, label);
    if (kb(gzipSync(Buffer.from(next, 'utf8'), { level: 9 }).length) === size) {
      html = next;
      settled = label;
      break;
    }
    html = next;
  }

  if (!settled) {
    throw new Error(
      `Page weight did not converge for ${relative(ROOT, file)} after ${MAX_PASSES} passes.`,
    );
  }

  await writeFile(file, html, 'utf8');
  return settled;
}

async function main() {
  const files = await htmlFiles(DIST);
  if (files.length === 0) throw new Error('No HTML in dist/. Run `npm run build`.');

  const stamped = [];
  for (const file of files) {
    const result = await stamp(file);
    if (result) stamped.push(`${relative(DIST, file)} ${result}`);
  }

  if (stamped.length === 0) {
    throw new Error(
      'No page carried a weight placeholder. Every page should render "00 kB" ' +
        'via the colophon. If the colophon no longer states a weight, remove this script.',
    );
  }

  console.log(`Colophon: measured ${stamped.length} page(s).`);
  for (const line of stamped) console.log(`  ${line}`);
}

main().catch((error) => {
  console.error(`\ncolophon-weight failed: ${error.message}\n`);
  process.exitCode = 1;
});
