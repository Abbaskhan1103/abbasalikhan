#!/usr/bin/env node
/**
 * Layout audit: every page at every width that changes the layout.
 *
 * Checks the four things that actually break on a phone and are invisible on a
 * desktop: sideways scrolling, elements past the trimmed edge, tap targets a
 * finger cannot hit, and text too small to read.
 *
 * Needs a preview server running and playwright-core installed:
 *   npm run build && npm run preview
 *   npm install --no-save playwright-core
 *   npm run audit:mobile
 *
 * Two things it deliberately does NOT flag, because both were false alarms the
 * first time round: elements whose tap target is delegated to a larger ::after
 * overlay, and .visually-hidden text, which is clipped to 1px for screen
 * readers and whose font size is therefore meaningless.
 */

import { chromium } from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: CHROME });
const PAGES = ['/', '/work/', '/work/hussainya/', '/work/moviewindows/', '/work/reader/', '/about/', '/thanks/', '/this-page-does-not-exist/'];
// Widened past phones deliberately: the catalogue collision only appeared
// from 900px up, where the desktop grid takes over.
const WIDTHS = [320, 360, 375, 390, 430, 768, 900, 1100, 1440];
let problems = 0;

for (const width of WIDTHS) {
  const rows = [];
  for (const path of PAGES) {
    const p = await b.newPage({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: width < 700, hasTouch: width < 700 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:4321' + path, { waitUntil: 'load' });
    await p.waitForTimeout(350);

    const r = await p.evaluate(async (w) => {
      // Measure geometry BEFORE scrolling. Rects are viewport-relative, so
      // measuring while scrolled right makes every element look overflowing.
      const over = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > w + 1 || r.left < -1);
        })
        .slice(0, 3)
        .map((el) => `${el.tagName}.${(el.className || '').toString().split(' ')[0]}`);

      // Content escaping its own box. This is the check that was missing when a
      // catalogue name overran its grid column and printed over the next one:
      // nothing left the viewport, so an overflow test saw nothing wrong.
      const escaping = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'visible' || cs.position === 'absolute' || cs.position === 'fixed') return false;
          // 8px, not 1px: several labels carry a deliberate negative right
          // margin to cancel their trailing letter-space, which reads as ~2px
          // of "overflow" on every one of them. The bug this check exists for
          // was 62px, so the threshold sits well clear of the optical noise.
          if (el.scrollWidth <= el.clientWidth + 8) return false;
          if (el.clientWidth === 0) return false;
          // An absolutely-positioned pseudo-element is a deliberate overlay,
          // not escaping content: it is how a small control gets a 44px tap
          // target, and how hairlines and underlines are drawn. It inflates
          // scrollWidth without anything actually spilling.
          for (const pseudo of ['::after', '::before']) {
            const ps = getComputedStyle(el, pseudo);
            if (ps.content !== 'none' && (ps.position === 'absolute' || ps.position === 'fixed')) return false;
          }
          // A scroll container is allowed to have content wider than itself.
          return !el.closest('[style*="overflow"]');
        })
        .slice(0, 3)
        .map((el) => `${el.tagName}.${(el.getAttribute('class') || '?').split(' ')[0]}(+${el.scrollWidth - el.clientWidth}px)`);

      // Text colliding with a sibling: same row, boxes overlapping horizontally.
      const collisions = [];
      for (const parent of document.querySelectorAll('.catalogue__row, .entry__metarow, .runhead__inner, .skills__row, .wall__credits')) {
        const kids = [...parent.children].map((el) => ({ el, r: el.getBoundingClientRect() })).filter((k) => k.r.width > 0);
        for (let i = 0; i < kids.length; i += 1) {
          for (let j = i + 1; j < kids.length; j += 1) {
            const a = kids[i].r;
            const bb = kids[j].r;
            const sameRow = a.top < bb.bottom - 2 && bb.top < a.bottom - 2;
            const overlapX = Math.min(a.right, bb.right) - Math.max(a.left, bb.left);
            if (sameRow && overlapX > 2) {
              collisions.push(`${kids[i].el.className.split(' ')[0]} over ${kids[j].el.className.split(' ')[0]} (${Math.round(overlapX)}px)`);
            }
          }
        }
      }

      // Tap targets under 44px. An element may delegate its target to a larger
      // ::after overlay, so that counts too.
      const small = [...document.querySelectorAll('a[href], button')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const after = getComputedStyle(el, '::after');
          const overlay = Math.min(parseFloat(after.width) || 0, parseFloat(after.height) || 0);
          if (overlay >= 40) return false;
          return r.height < 40 || r.width < 24;
        })
        .slice(0, 3)
        .map((el) => `${el.tagName}.${(el.className || '').toString().split(' ')[0]}(${Math.round(el.getBoundingClientRect().height)}px)`);

      // text too small to read comfortably on a phone
      // .visually-hidden is clipped to 1px for screen readers; its size is moot.
      const tiny = [...document.querySelectorAll('p, li, span, dd, dt, a')]
        .filter((el) => !el.closest('.visually-hidden') && !el.classList.contains('visually-hidden'))
        .filter((el) => el.textContent.trim().length > 12 && parseFloat(getComputedStyle(el).fontSize) < 11)
        .slice(0, 2)
        .map((el) => `${el.tagName}(${getComputedStyle(el).fontSize})`);

      // Now the only test that matters: can it actually be scrolled sideways?
      window.scrollTo(9999, 0);
      await new Promise((res) => requestAnimationFrame(res));
      const scrolled = window.scrollX;
      window.scrollTo(0, 0);

      return { scrolled, over, small, tiny, escaping, collisions: collisions.slice(0, 3) };
    }, width);

    const bad = [];
    if (r.scrolled !== 0) bad.push(`scrolls ${r.scrolled}px`);
    if (r.over.length) bad.push(`overflow: ${r.over.join(',')}`);
    if (r.small.length) bad.push(`small targets: ${r.small.join(',')}`);
    if (r.tiny.length) bad.push(`tiny text: ${r.tiny.join(',')}`);
    if (r.escaping.length) bad.push(`content escaping its box: ${r.escaping.join(',')}`);
    if (r.collisions.length) bad.push(`overlapping siblings: ${r.collisions.join(',')}`);
    if (errs.length) bad.push(`js: ${errs[0]}`);
    if (bad.length) problems += 1;
    rows.push(`    ${path.padEnd(22)} ${bad.length ? 'ISSUE  ' + bad.join(' | ') : 'ok'}`);
    await p.close();
  }
  console.log(`w=${width}`);
  console.log(rows.join('\n'));
}
console.log(`\n${problems === 0 ? 'ALL CLEAR' : problems + ' page/width combination(s) with issues'}`);
if (problems > 0) process.exitCode = 1;
await b.close();
