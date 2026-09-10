#!/usr/bin/env node
/**
 * Generates public/og.png (the 1200x630 social card) and public/apple-touch-icon.png.
 *
 * Run with `npm run og`. The output is committed to the repo rather than built
 * on every deploy, because rendering text depends on fonts installed on the
 * machine doing the rendering and a CI box will not have the same ones. Re-run
 * it only when the name, role or palette changes, and look at the result.
 */

import sharp from 'sharp';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PROJECTS = join(ROOT, 'src', 'content', 'projects');

/* Straight from src/styles/main.css. */
const PAGE = '#100F0D';
const INK = '#E8E4DA';
const MUTED = '#A8A296';
const HAIRLINE = '#2A2823';
const ACCENT = '#00A19B';

const NAME = ['Abbas', 'Ali Khan'];
const ROLE = 'SOFTWARE ENGINEER';
const PLACE = 'MELBOURNE, AUSTRALIA';
const SITE = 'ABBASALIKHAN.COM';

/** Didone stack, in descending order of how likely it is to be present. */
const DISPLAY = "Bodoni Moda, Bodoni 72, Didot, Hoefler Text, Times New Roman, serif";
const TEXT = "Archivo, Helvetica Neue, Helvetica, Arial, sans-serif";

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAGE}"/>

  <!-- trimmed edge rules and their registration ticks -->
  <line x1="0" y1="96" x2="1200" y2="96" stroke="${HAIRLINE}" stroke-width="1"/>
  <line x1="72" y1="93" x2="72" y2="99" stroke="#43403A" stroke-width="1"/>
  <line x1="1128" y1="93" x2="1128" y2="99" stroke="#43403A" stroke-width="1"/>

  <text x="72" y="62" font-family="${TEXT}" font-size="19" font-weight="600"
        fill="${MUTED}" letter-spacing="3.1">${escape(ROLE)}</text>
  <text x="1128" y="62" text-anchor="end" font-family="${TEXT}" font-size="19" font-weight="600"
        fill="${MUTED}" letter-spacing="3.1">${escape(PLACE)}</text>

  <text x="70" y="330" font-family="${DISPLAY}" font-size="132" font-weight="500"
        fill="${INK}" letter-spacing="-2.8">${escape(NAME[0])}</text>
  <text x="70" y="452" font-family="${DISPLAY}" font-size="132" font-weight="500"
        fill="${INK}" letter-spacing="-2.8">${escape(NAME[1])}</text>

  <!-- one vermilion rule, the site's only spot colour -->
  <line x1="72" y1="516" x2="392" y2="516" stroke="${ACCENT}" stroke-width="2"/>

  <text x="72" y="566" font-family="${TEXT}" font-size="21" font-weight="400"
        fill="${MUTED}">Three apps, designed and built solo.</text>
  <text x="1128" y="566" text-anchor="end" font-family="${TEXT}" font-size="19" font-weight="600"
        fill="${MUTED}" letter-spacing="3.1">${escape(SITE)}</text>

  <!-- press bar, bottom right, as on the page itself -->
  ${['#100F0D', '#171613', '#2A2823', '#A8A296', '#E8E4DA', ACCENT]
    .map((c, i) => `<rect x="${1128 - 6 * 28 + i * 28}" y="600" width="28" height="8" fill="${c}"/>`)
    .join('\n  ')}
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${PAGE}"/>
  <path d="M16 5V27M5 16H27" stroke="${ACCENT}" stroke-width="2"/>
  <rect x="9.5" y="9.5" width="13" height="13" fill="none" stroke="#43403A" stroke-width="1"/>
</svg>`;

/**
 * A card for one project. Same furniture as the site card, with the project's
 * name where the person's name goes, so a shared project link is recognisably
 * from this site rather than a generic fallback.
 */
function projectCard(title, tagline) {
  // Long names step down a size rather than running off the card.
  const size = title.length > 13 ? 96 : 132;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAGE}"/>
  <line x1="0" y1="96" x2="1200" y2="96" stroke="${HAIRLINE}" stroke-width="1"/>
  <line x1="72" y1="93" x2="72" y2="99" stroke="#43403A" stroke-width="1"/>
  <line x1="1128" y1="93" x2="1128" y2="99" stroke="#43403A" stroke-width="1"/>

  <text x="72" y="62" font-family="${TEXT}" font-size="19" font-weight="600"
        fill="${MUTED}" letter-spacing="3.1">${escape(NAME.join(' ').toUpperCase())}</text>
  <text x="1128" y="62" text-anchor="end" font-family="${TEXT}" font-size="19" font-weight="600"
        fill="${MUTED}" letter-spacing="3.1">${escape(PLACE)}</text>

  <text x="70" y="360" font-family="${DISPLAY}" font-size="${size}" font-weight="500"
        fill="${INK}" letter-spacing="-2.4">${escape(title)}</text>

  <line x1="72" y1="424" x2="392" y2="424" stroke="${ACCENT}" stroke-width="2"/>

  <text x="72" y="480" font-family="${TEXT}" font-size="26" font-weight="400"
        fill="${MUTED}">${escape(tagline.length > 62 ? tagline.slice(0, 59) + '...' : tagline)}</text>

  ${['#100F0D', '#171613', '#2A2823', '#A8A296', '#E8E4DA', ACCENT]
    .map((c, i) => `<rect x="${1128 - 6 * 28 + i * 28}" y="600" width="28" height="8" fill="${c}"/>`)
    .join('\n  ')}
</svg>`;
}

/** Pulls `title` and `tagline` out of a project's frontmatter. */
function frontmatter(source) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  const field = (name) => {
    const line = new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(block)?.[1] ?? '';
    return line.trim().replace(/^['"]|['"]$/g, '');
  };
  return { title: field('title'), tagline: field('tagline'), draft: field('draft') === 'true' };
}

await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile(join(PUBLIC, 'og.png'));
await sharp(Buffer.from(icon)).resize(180, 180).png({ compressionLevel: 9 }).toFile(join(PUBLIC, 'apple-touch-icon.png'));

await mkdir(join(PUBLIC, 'og'), { recursive: true });
const files = (await readdir(PROJECTS)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
const made = [];
for (const file of files) {
  const { title, tagline, draft } = frontmatter(await readFile(join(PROJECTS, file), 'utf8'));
  if (!title || draft) continue;
  const slug = file.replace(/\.md$/, '');
  await sharp(Buffer.from(projectCard(title, tagline)))
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, 'og', `${slug}.png`));
  made.push(slug);
}

console.log('Wrote public/og.png (1200x630) and public/apple-touch-icon.png (180x180).');
console.log(`Wrote ${made.length} project card(s): ${made.join(', ')}.`);
console.log('Look at them before shipping: text rendering depends on the fonts on this machine.');
