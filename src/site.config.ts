import portraitImage from './assets/portrait.jpg';

/**
 * SITE CONFIGURATION - THE SINGLE SOURCE OF TRUTH
 * ===============================================
 * Every word, link and colour token on this site comes from this file or from a
 * project file in `src/content/projects/`. No copy is written into a component,
 * so changing the site never means reading markup.
 *
 * Common edits:
 *   Add or edit a project   ->  src/content/projects/*.md  (copy _template.md)
 *   Change any wording      ->  the strings below
 *   Add a social profile    ->  `socials`  (read the warning above it first)
 *   Add your portrait       ->  `portrait`
 *   Change the accent       ->  `theme.accent`, and --accent in src/styles/tokens.css
 *
 * `npm run check` type-checks this file, so a missing or misspelt field is a
 * build error rather than a silently broken page.
 */

/** Canonical origin, no trailing slash. */
export const SITE_URL = 'https://abbasalikhan.com';

export interface SocialLink {
  label: string;
  href: string;
  handle?: string;
  /**
   * Whether to declare this profile in the structured-data `sameAs` list.
   *
   * READ THIS BEFORE ADDING A PROFILE. `sameAs` is an assertion that the profile
   * is the same person as the subject of this page. There is a well-known
   * Pakistani musician who shares this name and who holds the bare
   * "abbasalikhan" handle on Instagram, X, Facebook, YouTube and SoundCloud.
   * Declaring any of those as `sameAs` would tell search engines that the two
   * people are one person and merge the entities, which is difficult to undo.
   * Only ever list a profile you personally control, and prefer the "-au"
   * handle pattern already established on LinkedIn.
   */
  sameAs: boolean;
}

export interface NavLink {
  label: string;
  href: string;
  /** Gate: 'blog' means the link only appears once the blog is switched on. */
  when?: 'blog';
}

export interface Fact {
  label: string;
  value: string;
  /**
   * Optional footnote on one term inside `value`. The term is matched in the
   * string and a marker is placed straight after it, so the copy stays one
   * readable sentence here rather than being split across fields.
   */
  gloss?: {
    /** Must appear verbatim in `value`, or the marker is simply not rendered. */
    term: string;
    /** Screen-reader label for the marker, phrased as a question. */
    label: string;
    body: string;
  };
}

export const site = {
  url: SITE_URL,
  domain: 'abbasalikhan.com',

  // ---------------------------------------------------------------- identity
  identity: {
    name: 'Abbas Ali Khan',
    /**
     * What people actually call him. Used wherever the copy is conversational,
     * so the page reads like a person talking rather than a legal document.
     *
     * The full name stays on the things that establish identity: the title,
     * the masthead, the h1, the copyright line and the structured data. Those
     * are what a search engine reads to work out who this is, and there are
     * two other well-known Abbas Ali Khans to be told apart from.
     */
    shortName: 'Ali',
    /** The masthead sets the name in these lines, in order. */
    nameLines: ['Abbas', 'Ali', 'Khan'],
    /** Other spellings people search for. Feeds structured data only. */
    alternateNames: ['Ali Khan', 'Abbas Khan', 'Abbas A. Khan'],
    role: 'Software engineer',
    location: {
      city: 'Melbourne',
      region: 'Victoria',
      regionCode: 'VIC',
      country: 'Australia',
      countryCode: 'AU',
      /** Shown to readers wherever the place is named in prose. */
      label: 'Melbourne, Australia',
      /**
       * Melbourne's Aboriginal name. Left empty deliberately rather than assumed.
       * Set it to 'Naarm' if you want the page to read "Naarm, Melbourne".
       */
      firstNationsName: '',
      latitude: -37.8136,
      longitude: 144.9631,
      timezone: 'Australia/Melbourne',
    },
    /** Public email. Empty string hides every email link on the site. */
    email: 'abbasalikhan.au@gmail.com',
    /**
     * Portrait, shown on /about/ and declared in the structured data. A profile
     * image is close to required for a knowledge panel or an AI answer card.
     *
     * Imported as an asset rather than referenced from `public/`, so Astro
     * converts it to AVIF and WebP and writes its dimensions itself. To replace
     * it, drop a new square image over `src/assets/portrait.jpg`. Set `image`
     * to `null` and the block disappears from the page and the schema.
     *
     * `src/assets/portrait-original.jpg` is the uncropped source, kept so the
     * crop can be revisited. Nothing references it, so it is never shipped.
     */
    portrait: {
      image: portraitImage as ImageMetadata | null,
      alt: 'Abbas Ali Khan on the coast in Melbourne, Australia.',
    },
    /** Subjects to associate this person with. Structured data only. */
    /**
     * Kept in step with `sections.skills` on purpose: the visible list and the
     * machine-readable one disagreeing is exactly the sort of inconsistency
     * that stalls entity consolidation.
     */
    knowsAbout: [
      'Software engineering',
      'Web application development',
      'iOS app development',
      'Android app development',
      'UI and UX design',
      'Product design',
      'Agentic AI development',
      'Workflow automation',
    ],
  },

  // ----------------------------------------------------------------- socials
  socials: [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/abbasalikhan-au/',
      handle: 'abbasalikhan-au',
      sameAs: true,
    },
  ] as SocialLink[],

  // --------------------------------------------------------------------- seo
  seo: {
    /** Under 60 characters so search results do not truncate it. */
    title: 'Abbas Ali Khan | Software Engineer in Melbourne',
    /** 150 to 160 characters. This is the sentence shown under the result. */
    description:
      'Abbas Ali Khan is a software engineer in Melbourne, Australia. Outside work he designs, builds and ships his own apps for reading, home media and community.',
    /** Short human phrase used after the name in social titles. */
    tagline: 'Software engineer, Melbourne',
    ogImage: '/og.png',
    ogImageAlt:
      'Abbas Ali Khan, software engineer in Melbourne, Australia.',
    locale: 'en-AU',
    ogLocale: 'en_AU',
    /**
     * X/Twitter handle for card attribution, including the leading @.
     * Leave empty unless you own it. Never set this to @abbasalikhan, which
     * belongs to the musician who shares the name.
     */
    twitterHandle: '',
  },

  // ------------------------------------------------------------------ layout
  /** Running head across the top of every page. */
  runningHead: {
    /** Shortened form used below 600px. */
    short: 'AAK',
  },

  /**
   * Primary navigation. Order is display order. A link whose `when` is false is
   * not rendered, which is how the blog stays out of the nav until it has posts.
   */
  nav: [
    { label: 'Work', href: '/work/' },
    { label: 'About', href: '/about/' },
    { label: 'Writing', href: '/writing/', when: 'blog' },
  ] as NavLink[],

  /**
   * BLOG
   * ----
   * Off. While this is false no writing pages are built, nothing appears in the
   * nav, and `/writing/` does not exist. The collection, schema and routes are
   * all in place, so switching it on is this one flag plus at least one post in
   * `src/content/writing/` with `draft: false`.
   */
  blog: {
    enabled: false,
    label: 'Writing',
    heading: 'Notes',
    lede: 'Occasional writing about what I am building and what it taught me.',
  },

  sections: {
    /** 00 - the full-height title wall. */
    titleWall: {
      /** Three label-over-value cells above the name. */
      credits: [
        { label: 'Role', value: 'Software engineer' },
        { label: 'Place', value: 'Melbourne, Australia' },
      ] as Fact[],
      /**
       * Third-person editorial standfirst, in the manner of a magazine. This is
       * the first body copy on the page, so it deliberately carries the name, the
       * city and the country in one natural sentence. `{count}` is replaced with
       * the number of live projects.
       */
      standfirst:
        'Ali makes small, opinionated apps from a desk in Melbourne, Australia. {count} of them are listed here.',
      /** Hairline-separated rows beside the name. Keep every value knowable and true. */
      facts: [
        {
          label: '',
          value: 'Software engineer by day, vibe coder by night',
          gloss: {
            term: 'vibe coder',
            label: 'What is a vibe coder?',
            body: 'Someone who knows exactly what the finished thing has to do, and brings real engineering practice to getting there: reading and understanding the code rather than trusting it, and closing gaps and vulnerabilities as they appear rather than after launch. With the right systems around it, AI tooling turns concept into production in a fraction of the usual time.',
          },
        },
        { label: '', value: 'Designed, built and released solo' },
        { label: '', value: 'iOS, Android and Windows' },
      ] as Fact[],
      /** The only affordance above the fold. `{range}` becomes e.g. "01—03". */
      indexLink: '↓ {range} The index',
    },

    /** 01 - the numbered contents table. */
    contents: {
      label: 'Contents',
      /** Column headings for the index table. */
      columns: {
        folio: 'No.',
        name: 'Project',
        category: 'Field',
        platforms: 'Runs on',
        status: 'Status',
      },
    },

    /** 02..N - one entry per project. Labels for the metadata table. */
    entry: {
      meta: {
        role: 'Role',
        platforms: 'Runs on',
        status: 'Status',
      },
      /** Every project here is solo work, so the role is constant. */
      roleValue: 'Design, build, release',
      /** Prefix for the visually hidden ordinal that screen readers announce. */
      ordinal: 'Entry {n} of {total}',
    },

    /** 06 - the practice note. */
    practice: {
      label: 'The practice',
      heading: 'How this works',
      /**
       * First person, in his own voice. The standfirst above is third person and
       * carries the search-facing sentence; this is the part a human reads to
       * decide whether they like him. Read it and make it sound like you.
       *
       * The first paragraph takes a drop cap.
       */
      paragraphs: [
        'Most of what I build for myself started the same way. Something I used every day was worse than it needed to be, nobody was going to fix it, and the fix was small enough that one person could do it. So I did it, and then kept going until the thing was genuinely usable rather than merely demonstrable. None of it was planned as a body of work.',
        'What they have in common is a conviction about ownership. The things you already own should stay yours: your files, your library, what you read, what your own week looks like. A lot of software treats those as something to hold on your behalf, behind an account you have to keep alive and a subscription that renews whether you opened the app or not. I did not want to build more of that.',
        'A promise not to misuse what you own is worth very little by itself, because whoever made it can change their mind or need the money. So where I can, I try to make the promise structural instead: not a line in a policy, but something the software has no ability to do in the first place. That is harder to build, and it is the only version of the promise I would believe coming from someone else. What I am after in the end is software that is finished, in the old sense. It does the thing, it asks nothing monthly, and it does not need me to stay interested for it to keep working.',
      ],
      /**
       * Numbered marginalia in the left column. One line each. These are notes,
       * not claims: keep them true.
       */
      marginalia: [
        'The projects listed here began as problems I had myself.',
        'Built solo. Design, code, release notes.',
        'The status on each entry is honest, not optimistic.',
        'There is a Pakistani musician with this name. This is the other Abbas Ali Khan.',
        'Melbourne, Australia. Reachable on LinkedIn.',
      ],
    },

    /**
     * WHAT I WORK IN
     * -------------
     * Renders on /about/ only, and only when `groups` has entries. Leave it
     * empty and the whole block disappears.
     *
     * Written as groups so it can hold technologies and domains side by side,
     * e.g. { label: 'Mobile', items: ['Swift', 'Kotlin'] } next to
     * { label: 'Domains', items: ['Health tracking', 'Community software'] }.
     *
     * Deliberately not a progress bar, a percentage or a grid of logos: those
     * are the house style of generated portfolios, and none of them tell a
     * reader anything a plain list does not.
     */
    skills: {
      label: 'What I work in',
      groups: [
        { label: 'Building', items: ['Web applications', 'iOS apps', 'Android apps'] },
        { label: 'Design', items: ['UI and UX design', 'Product design'] },
        { label: 'AI', items: ['Agentic design and development'] },
        { label: 'Automation', items: ['Workflows', 'Automations', 'Integrations'] },
        /*
         * Domains rather than tools. These three are the fields the shipped
         * work actually sits in, so the row stays true as the catalogue grows.
         */
        { label: 'Domains', items: ['Community software', 'Home media', 'Reading'] },
      ] as Array<{ label: string; items: string[] }>,
    },

    /** The get-in-touch section, shown at the foot of every page. */
    contact: {
      label: 'Get in touch',
      heading: 'Happy to talk.',
      /**
       * Written to invite a conversation rather than a brief. He has a job; this
       * is not a services pitch.
       */
      lede: 'If you are building something, stuck on something, or just want to compare notes, send me a line. I read everything.',
      note: 'Melbourne, Australia.',
    },

    /** /work/ - the full catalogue. */
    work: {
      label: 'Work',
      heading: 'Some of what I have built.',
      lede: 'A few of the apps I have designed, built and released on my own. Each one started as something I needed and could not buy.',
    },

    /** /work/<slug>/ - headings inside a project page. */
    project: {
      problem: 'Why it exists',
      approach: 'The approach',
      capabilities: 'What it does',
      next: 'Where it is now',
      backToWork: 'All work',
      nextProject: 'Next',
    },

    /** /about/ */
    about: {
      label: 'About',
      /** Doubles as the page's h1. See the note in src/pages/about.astro. */
      lede: 'Software engineer in Melbourne, Australia. I build apps on off hours, from ideation to deployment.',
    },

    /** 07 - the colophon band. */
    colophon: {
      label: 'Colophon',
      /** Heading above the contact line. */
      heading: 'Get in touch',
      /**
       * The closing note. `{weight}` is replaced at build time with the real
       * gzipped page weight, because a colophon that lies is worse than none.
       */
      note: 'Set in Bodoni Moda and Archivo, both self-hosted. Twelve-column grid, 24px baseline. {weight}, no runtime framework, no analytics, no third-party requests, no cookies. Melbourne, {year}.',
    },
  },

  /**
   * AUDIENCE CAPTURE
   * ----------------
   * Off by default. While `enabled` is false no form is rendered, no endpoint is
   * advertised and the page ships exactly as it does today.
   *
   * To switch it on:
   *   1. Set `enabled: true` here.
   *   2. Set CRM_PROVIDER and that provider's key as environment variables on
   *      your host. See README, "Capturing signups".
   *   3. Deploy. The key stays on the server and never reaches the browser.
   *
   * The same endpoint serves a newsletter box, a lead form and a per-post
   * subscribe box; they are told apart by the `source` each form sends, so
   * adding a blog later needs no new plumbing.
   */
  crm: {
    enabled: false,

    /** Must stay same-origin: the CSP allows form posts to 'self' only. */
    endpoint: '/api/subscribe',

    /** Identifies signups from the site-wide box. */
    source: 'newsletter',

    /** Where a no-JavaScript submission lands. */
    successPath: '/thanks/',

    copy: {
      label: 'Newsletter',
      heading: 'Occasional notes',
      lede: 'What I am building, why it broke, and what fixed it. A few times a year, never more.',
      emailLabel: 'Email address',
      placeholder: 'you@example.com',
      submit: 'Subscribe',
      /** Shown under the field. Keep it honest and short. */
      note: 'No tracking, no sharing. One click to leave.',
      /** Feedback messages. `already` must read as success, not failure. */
      success: 'You are on the list. Check your inbox to confirm.',
      already: 'You are already on the list.',
      invalid: 'That email address does not look right.',
      error: 'That did not go through. Please try again in a moment.',
    },
  },

  footer: {
    /** `{year}` is replaced at build time. */
    copyright: '© {year} Abbas Ali Khan',
  },

  // ------------------------------------------------------------------- theme
  /**
   * Values needed by HTML meta tags. The full palette lives in
   * `src/styles/tokens.css` as named custom properties. If you change the accent,
   * change it in both places.
   */
  theme: {
    accent: '#00A19B',
    background: '#100F0D',
    themeColor: '#100F0D',
  },
} as const;

export type Site = typeof site;

/** Profiles structured data should declare as the same person. */
export const sameAs: string[] = site.socials
  .filter((s) => s.sameAs)
  .map((s) => s.href);

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, `${SITE_URL}/`).href;
}

/** Replace `{key}` placeholders in a config string. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
