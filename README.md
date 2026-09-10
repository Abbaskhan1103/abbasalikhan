# abbasalikhan.com

The personal site of Abbas Ali Khan, a software engineer in Melbourne.

Static, self-contained and fast: no runtime framework, no analytics, no cookies,
no third-party requests of any kind. Every word, link and colour comes from one
config file or from a project file, so changing the site never means reading
markup.

```
100 / 100 / 100 / 100   Lighthouse (performance, accessibility, best practices, SEO)
        10 kB           the whole document, gzipped, CSS and JS included
             0          layout shift, blocking time, third-party requests
             0          npm vulnerabilities
```

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # type-check, build, then measure and harden the output
npm run verify     # 60-odd checks against the built site. Run before every deploy.
npm test           # tests for the signup endpoint and its bot defences
npm run preview    # serve dist/ exactly as it will be served in production
```

`npm run build` runs three things in order: `astro check` (types and content
schema), the build, then `npm run postbuild`, which measures the page's real
gzipped weight and writes it into the colophon, and hashes every inline style
and script into the Content-Security-Policy. Neither post-build step can be
skipped, because the colophon would then state a false size and the CSP would
block the fonts.

---

## Structure

```
/                     the entity home: masthead, selected work, contact
/work/                the full catalogue
/work/<slug>/         one page per project, with its own case study
/about/               portrait, practice note, and the skills block
/writing/             scaffolded, and switched off. See "The blog" below.
/thanks/              where a no-JavaScript signup lands
/404/
```

**The entity home is `/` and must never move.** The `Person` node's `@id` is
anchored to that URL, and every profile link, citation and backlink resolves
there. Subpages reference the same `@id`; they never define a different one.
`npm run verify` fails the build if two pages ever disagree.

Each project having its own URL is the main reason this is not one page any
more: on a single page the three projects compete for one result, and none of
them can rank for its own name.

## Adding a project

This is the one thing designed to be effortless.

1. Copy `src/content/projects/_template.md` to a new file in the same folder,
   e.g. `src/content/projects/newthing.md`.
2. Fill in the fields. The comments in the template explain each one.
3. Set `draft: false` and give it an `order` (lower numbers appear first).

Nothing else changes. The contents index, the entry, the numbering, the
structured data, the sitemap and the "N of them are listed here" line in the
opening paragraph all follow automatically.

Every field is validated when you build, so a typo fails the build with a
precise message instead of quietly shipping a broken page. Filenames beginning
with `_` are ignored, which is what keeps the template off the site.

**Ordering.** `order` ascending, then alphabetical. The current order is
Hussainya (10), MovieWindows (20), Reader (30). To reorder, change the numbers.

**The case study.** `problem`, `approach`, `next` and `capabilities` are all
optional. Without them the project page falls back to the summary and
highlights, so a new project is publishable in one sitting and can be deepened
later.

**Screenshots.** Optional. Drop an image in `src/assets/projects/` and set
`cover:` and `coverAlt:`. Astro converts it to AVIF and WebP and writes the
dimensions. With no cover, the entry's plate shows the project's `highlights` as
a printed specimen list, which is the default treatment and needs no assets.

---

## Where every value lives

| What | File |
| --- | --- |
| Name, role, location, email, portrait, social links | `src/site.config.ts` |
| Navigation | `src/site.config.ts` -> `nav` |
| Skills block on /about/ | `src/site.config.ts` -> `sections.skills` (empty = hidden) |
| All section copy: standfirst, practice note, marginalia, colophon | `src/site.config.ts` |
| SEO title, description, social card text | `src/site.config.ts` → `seo` |
| Projects | `src/content/projects/*.md` |
| Project field rules and validation | `src/content.config.ts` |
| Colours, type scale, spacing, grid | `src/styles/main.css` → section 1 |
| Structured data (JSON-LD) | `src/lib/schema.ts` |
| Security and caching headers | `public/_headers` |
| Social cards and favicon | `npm run og` -> `public/og.png` and `public/og/<slug>.png` |

Nothing is hardcoded in a component. If you find a string in `src/components/`
that should be editable, it belongs in `site.config.ts`.

---

## Deploying

The output in `dist/` is plain static files. Any static host will serve it, but
`public/_headers` is read automatically by **Cloudflare Pages** and **Netlify**,
which is where the security headers come from. Cloudflare Pages is the
recommendation: free, fast in Australia, HTTP/3 and Brotli by default.

**Cloudflare Pages**

1. Put this folder in a Git repository and push it.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command `npm run build`, output directory `dist`, Node version 22.
4. Custom domains → add `abbasalikhan.com` **and** `www.abbasalikhan.com`.
   Cloudflare will 301 the `www` form to the apex for you. Keep it to one hop.
5. Deploy, then run `npm run verify` locally and check the live headers at
   <https://securityheaders.com> and <https://csp-evaluator.withgoogle.com>.

**Netlify** — same, and `_headers` is picked up as-is.

**Vercel** — reads `vercel.json` instead. The CSP there has no inline hashes, so
after your first build copy the `Content-Security-Policy` line out of
`dist/_headers` into `vercel.json`, or the fonts will be blocked.

### DNS

The domain currently points at Namecheap parking. Move the nameservers to your
host, then:

- `A` / `CNAME` for the apex, pointing at the host.
- **`AAAA`** as well. There is no IPv6 record today.
- `CAA` limiting certificate issuance to your host's CA.
- Confirm `http` → `https` and `www` → apex are each a single 301.

---

## Launch checklist

The site is the easy half. For the name to resolve to you, these matter more
than any markup, and none of them can be done from this repo.

### Do these first

- [ ] **Fix the LinkedIn headline.** `linkedin.com/in/abbasalikhan-au` currently
      reads "AI Automation, Business Analysis, Data", which contradicts
      "software engineer". A search engine cross-checks the site's claim
      against your strongest external profile, and a mismatch stalls the whole
      thing. Every other signal is downstream of this one.
- [ ] Set the LinkedIn **website field** to `https://abbasalikhan.com` and open
      the About section with "Abbas Ali Khan is an independent app maker based in
      Melbourne, Australia."
- [x] ~~Add a portrait.~~ Done. `src/assets/portrait.jpg`, shown on /about/ and
      declared in the Person schema. To replace it, drop a new square image over
      that file. `src/assets/portrait-original.jpg` is the uncropped source, kept
      so the crop can be revisited; nothing references it, so it never ships.
- [ ] Verify the domain in **Google Search Console** by DNS TXT record (it
      survives host migrations), submit the sitemap, then request indexing.
- [ ] **Bing Webmaster Tools** — import from Search Console and enable IndexNow.
      Bing feeds several answer engines, so it matters more than its share suggests.

### Then

- [ ] Add store or release links to each project's `links:` array. Outbound
      links to store domains are corroboration, not leaks.
- [ ] Claim the `-au` handle pattern on GitHub, Bluesky, Mastodon, Product Hunt
      and about.me, and set each one's website field to `abbasalikhan.com`. Use a
      byte-identical bio everywhere; paraphrased variants read as different people.
- [ ] Build two or three Melbourne-specific mentions: a meetup profile, a local
      tech directory, an event listing. `abbas ali khan melbourne` is the query
      you can actually win, and these decide it.

### Never do these

- **Never add a bare `abbasalikhan` handle to `socials`.** A well-known Pakistani
  musician holds that exact handle on Instagram, X, Facebook, YouTube and
  SoundCloud. Declaring one as `sameAs` asserts that you are him and merges the
  two entities, which is hard to undo. `npm run verify` fails the build if one
  appears. Only list profiles you personally control.
- **Do not create a Wikidata item yet.** A premature item for a person with no
  independent references gets deleted and can leave lasting confusion. Wait until
  six to ten real third-party sources exist.
- **Do not move the entity home.** `https://abbasalikhan.com/` is the canonical
  URL and the `@id` every profile resolves to. If the site ever grows subpages,
  keep the Person `@id` anchored to the apex.

### What to expect

`abbas ali khan` is a contested name: a Pakistani classical vocalist and a
Bangladeshi politician both hold Wikipedia articles, and the vocalist very likely
holds the knowledge panel. First place on the bare name is not a realistic
target in year one, and chasing it is the most likely way to waste the effort.

`abbas ali khan melbourne` is owned by nobody and is winnable in weeks. So are
`abbas ali khan app maker`, `abbas ali khan developer` and every project name.
Aim at those, and treat page-one presence plus a separate disambiguation card on
the bare name as the year-one win.

---

## The blog

Off. `site.blog.enabled` is `false`, so `/writing/` is not built, nothing enters
the sitemap, and no nav link appears. The collection, the schema, both routes
and the styling are all in place.

To switch it on: add a post to `src/content/writing/` (copy `_template.md`) with
`draft: false`, set `blog.enabled: true`, and rebuild.

One piece of advice, since it is easier to start a blog than to keep one: an
abandoned blog with two posts is a worse signal than no blog at all. Wait until
you have three you are happy with, then turn it on.

## Capturing signups

There is a complete, provider-agnostic capture endpoint in the repo, and it is
**switched off**. While `site.crm.enabled` is `false` no form renders, no script
ships, and the page is byte-for-byte what it is today.

### Switching it on

1. `src/site.config.ts` -> `crm.enabled: true`.
2. Set environment variables on your host (Cloudflare: Settings -> Environment
   variables; mark keys as **Secret**):

   | Provider | `CRM_PROVIDER` | Also needs |
   | --- | --- | --- |
   | Log only (default) | `none` | nothing. Signups appear in the function log and are stored nowhere. |
   | Any URL you control | `webhook` | `CRM_WEBHOOK_URL`, optionally `CRM_WEBHOOK_SECRET` |
   | HubSpot | `hubspot` | `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_GUID` |
   | Mailchimp | `mailchimp` | `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID` |
   | Buttondown | `buttondown` | `BUTTONDOWN_API_KEY` |
   | Resend | `resend` | `RESEND_API_KEY`, optionally `RESEND_AUDIENCE_ID` |
   | Loops | `loops` | `LOOPS_API_KEY`, optionally `LOOPS_MAILING_LIST_ID` |

3. Deploy. Keys stay on the server and never reach the browser.

Start on `none`, submit the form once, and confirm the address appears in your
host's function log. Then switch to the real provider. That way, if something
breaks you know whether it is the form or the provider.

### How it is put together

```
src/lib/crm/
  types.ts          the CrmAdapter contract
  validate.ts       parsing, email checks, honeypot, timing
  index.ts          the adapter registry and the whole request handler
  adapters/*.ts     one file per provider
functions/api/subscribe.ts    Cloudflare Pages Function (a two-line shim)
```

**Adding a provider** is one file in `adapters/` plus one line in the registry in
`index.ts`. Nothing else in the codebase knows which provider is in use.

**Nothing about the Astro build changes.** Astro only ever reads `src/pages` and
`public`, so the top-level `functions/` directory is invisible to it. The site
stays pure static output with no SSR adapter; Cloudflare bundles the function
separately and it sits in front of `dist/`. `public/_routes.json` keeps every
static request on the free unlimited path so only `/api/*` invokes compute.

The handler takes and returns web-standard `Request` and `Response`, so Netlify
and Vercel need only their own two-line shim around `handleSubscribe`.

### Newsletters, leads and, later, blog posts

Every form posts to the same endpoint and is told apart by a `source` string, so
one endpoint already covers all three. The site-wide box sends `newsletter`; a
lead form would send `contact`; a per-post box on a blog would send
`blog:<post-slug>`, which the adapters pass through as a tag. Adding a blog is
then a second content collection, not new plumbing.

### What it defends against, and what it does not

Handled: cross-origin posts (rejected server-side, not just by the CSP), a
honeypot field, a minimum fill time, oversized bodies, malformed addresses, and
provider errors and duplicates, which are reported as success because a
returning subscriber has done nothing wrong. Provider detail is logged
server-side and never returned to the browser. `npm test` covers all of this.

Not handled: real rate limiting. A stateless edge function has nowhere to keep a
counter, and anything in-memory resets constantly and is theatre. If the endpoint
ever gets abused, add a Cloudflare rate-limiting rule on `/api/subscribe` in the
dashboard, which is the correct layer for it.

## How it is built

**Astro 7**, static output, no client framework. The only JavaScript on the page
is about 2 kB inline: the Melbourne clock, three IntersectionObservers, and a
keyboard handler. Nothing needed to read or navigate the page depends on it.

**Fonts** are Bodoni Moda and Archivo, downloaded at build time and served from
this origin. Astro measures each face and writes a metric-matched local fallback,
which is why layout shift is zero even though the fonts load asynchronously. No
request ever goes to Google.

**CSS** is one hand-written file, inlined into the document, so the page paints
in a single round trip with no render-blocking request.

**Security.** The CSP has no `unsafe-inline` and no `unsafe-eval`: every inline
block is hashed at build time by `scripts/csp-hashes.mjs`, which reads the real
built HTML, so the hashes cannot drift out of date. `default-src` is `'self'` and
no third-party origin is permitted at all, because none is used.

### Design notes

Dark-committed, one spot colour (`#00A19B`), no `border-radius`, no
`box-shadow`, no blur. Depth is one step up, one step down, and 1px hairlines.
Every text colour clears **7:1** (WCAG AAA) against all three surfaces; the
accent sits at 5.99:1 for marks and rules, with a lighter `--accent-text` at
7.56:1 for anything with a letterform in it.

The plates and the masthead lean towards the pointer in real 3D: the mat rotates
while its contents ride forward on the Z axis, so the movement parts them instead
of skewing one flat plane, and a soft highlight tracks the cursor across the mat.
It is transform and opacity only, so it runs entirely on the compositor and costs
nothing measurable. Pointer devices only, and disabled outright under
`prefers-reduced-motion`. The unlit state of a plate is a scrim rather than a
`filter`, because a filter on an ancestor flattens `preserve-3d` and would
collapse the whole effect.

The signature moment is the marginal folio: a Didone numeral debossed into the
left margin that rolls as each entry centres, tied to the live entry by one
vermilion hairline. It is decoration only, sized to its margin so it never
touches the text, and every entry carries "Entry N of M" as real text for screen
readers. On phones and under `prefers-reduced-motion` each entry prints its own
numeral instead, so the fallback is a design rather than a degradation.

Icons are inline SVG on a shared 24x24 grid, drawn to one set of rules: line
pictograms at 1.6 stroke, brand marks as solid silhouettes, never both in one
icon. They take `currentColor` and size in `em`, so an icon sits in a line of
text the way a letter does rather than needing its own layout. The whole set is
`src/components/Icon.astro`; adding one means adding a path and a name.

Each project shows its real app icon, framed identically everywhere it appears,
which is what makes three products with three different visual languages read as
one catalogue. Platform support shows as marks rather than a comma-separated
list, deduplicated so a project on iOS and iPadOS does not print two apples.

Pages fade into one another using native cross-document view transitions, which
need no JavaScript at all; the running head is excluded from the transition so
it holds its place while the content changes underneath. Browsers without
support simply navigate, which is the same thing without the fade.

Press <kbd>g</kbd> on the live site to overlay the 24px baseline grid.

---

## Verification

`npm run verify` checks the built output for the things that are easy to break
and hard to see: duplicate or missing structured-data nodes, heading order,
`sameAs` entity-merge risks, inline blocks missing a CSP hash, third-party
origins creeping in, `target="_blank"` without `rel="noopener"`, blocked AI
crawlers, images without dimensions, name over-repetition, page weight, and
whether the colophon's stated size is still true. It exits non-zero on failure,
so it can sit in front of a deploy step.

It also walks every built page, checking that each has exactly one `<h1>`, one
canonical pointing at itself and one JSON-LD block; that the `Person` node is
byte-identical across all of them; and that no internal link points at a page
that was not built.

Currently zero failures and zero warnings.

### Mobile

`npm run audit:mobile` walks all eight pages at 320, 360, 375, 390, 430 and
768px and fails on sideways scrolling, anything past the trimmed edge, tap
targets under 44px, or text under 11px. It needs a preview server running and
`npm install --no-save playwright-core`.
