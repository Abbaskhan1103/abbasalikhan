#!/usr/bin/env node
/**
 * Loads every page under the REAL production headers and fails on any CSP
 * violation. Needs `npm run preview:real` running and playwright-core installed.
 *
 * This is the check that was missing. 81 inline style attributes shipped and
 * were blocked in production, because `astro preview` serves no headers at all
 * and every local check therefore passed.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4400';
const PAGES = ['/', '/work/', '/work/hussainya/', '/work/moviewindows/', '/work/reader/', '/about/', '/thanks/', '/nope/'];
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b = await chromium.launch({ executablePath: CHROME });
let total = 0;

for (const path of PAGES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const violations = [];
  p.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|violates the following/i.test(t)) violations.push(t.slice(0, 150));
  });
  await p.goto(BASE + path, { waitUntil: 'load' });
  // Interact, so violations from event-driven style writes surface too.
  await p.mouse.move(700, 500);
  await p.mouse.move(900, 400);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(1200);

  const unique = [...new Set(violations)];
  total += unique.length;
  console.log(`${path.padEnd(22)} ${unique.length === 0 ? 'no CSP violations' : unique.length + ' VIOLATION(S)'}`);
  for (const v of unique.slice(0, 2)) console.log(`    ${v}`);
  await p.close();
}

console.log(`\n${total === 0 ? 'CLEAN - the policy allows everything the pages actually do' : total + ' violation(s) across the site'}`);
if (total > 0) process.exitCode = 1;
await b.close();
