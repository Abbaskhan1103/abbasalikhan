import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * PROJECTS COLLECTION
 * -------------------
 * To add a project: copy `src/content/projects/_template.md` to a new file in the
 * same folder and fill it in. That's it. No other file needs to change.
 *
 * Every field below is validated at build time, so a typo or a missing field fails
 * the build with a precise error instead of quietly shipping a broken page.
 */

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const projects = defineCollection({
  // Files starting with `_` are ignored, which is what keeps `_template.md` out of the site.
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z
      .object({
        /** Product name, shown as the project heading. */
        title: z.string().min(1).max(60),

        /** One punchy line under the title. Keep it short. */
        tagline: z.string().min(3).max(90),

        /**
         * Plain-text version of the description, used for structured data and social
         * cards. Machine consumers cannot read Markdown, so this has to be plain.
         */
        summary: z.string().min(40).max(320),

        /** Broad grouping, e.g. "Reading", "Wellbeing", "Media". Shown as metadata. */
        category: z.string().min(2).max(40),

        /** Where a person can actually use it. Leave empty to hide the row. */
        platforms: z.array(z.string().min(1).max(24)).default([]),

        /** Shipping state. Constrained so the labels stay consistent across the site. */
        status: z
          .enum(["Shipped", "Beta", "In development", "Prototype"])
          .default("Shipped"),

        /**
         * Optional, and not displayed anywhere. Kept only because structured
         * data can use a `datePublished`, which helps a search engine place the
         * work in time without putting a date in front of a reader.
         */
        year: z
          .string()
          .regex(/^\d{4}(\s?[-–]\s?(\d{4}|present))?$/, {
            message: 'Use "2025", "2024 - 2025" or "2024 - present".',
          })
          .optional(),

        /** Up to four short capability phrases. Six words each, maximum. */
        highlights: z.array(z.string().min(2).max(60)).max(4).default([]),

        /** Per-project accent colour. Falls back to the site accent when omitted. */
        accent: z
          .string()
          .regex(HEX, { message: "Use a hex colour such as #C8A24B." })
          .optional(),

        /** Outbound links (store listing, site, repo). Rendered in listed order. */
        links: z
          .array(
            z.object({
              label: z.string().min(1).max(24),
              href: z.url(),
            }),
          )
          .max(4)
          .default([]),

        /** Lower numbers appear first. Ties fall back to alphabetical order. */
        order: z.number().int().min(0).default(100),

        /**
         * The product's own app icon. Shown beside the project everywhere it is
         * listed, which is what makes a catalogue of three apps read as three
         * products rather than three paragraphs.
         *
         * Put the file in `src/assets/projects/` and reference it relatively.
         * Square, 512px or larger. Astro converts it and sizes it for you.
         */
        icon: image().optional(),

        /**
         * CASE STUDY, shown on the project's own page at /work/<slug>/.
         * All optional: without them the page falls back to the summary and
         * highlights, so a new project is still publishable in one sitting.
         */
        problem: z.string().min(80).max(1200).optional(),
        approach: z.string().min(60).max(1200).optional(),
        next: z.string().min(40).max(800).optional(),

        /** Expanded capabilities. Replaces `highlights` on the project page. */
        capabilities: z
          .array(
            z.object({
              title: z.string().min(2).max(60),
              detail: z.string().min(10).max(320),
            }),
          )
          .max(8)
          .default([]),

        /**
         * Optional screenshot for the entry's plate. Put the file in
         * `src/assets/projects/` and reference it relatively, e.g.
         * `cover: ../../assets/projects/reader.png`. Astro converts it to AVIF and
         * WebP at build time and writes the width and height for you.
         *
         * With no cover, the plate shows the project's highlights as a printed
         * specimen list instead, which is the default treatment.
         */
        cover: image().optional(),

        /** Alt text for the cover. Required whenever `cover` is set. */
        coverAlt: z.string().min(10).max(180).optional(),

        /** Set true to keep a project in the repo but off the live site. */
        draft: z.boolean().default(false),
      })
      .refine((d) => !d.cover || !!d.coverAlt, {
        message:
          "coverAlt is required when cover is set (screen readers need it).",
        path: ["coverAlt"],
      }),
});

/**
 * WRITING COLLECTION
 * ------------------
 * Scaffolded, and currently unused: no route builds until `site.blog.enabled`
 * is true in src/site.config.ts. Add a post here, flip that flag, and the
 * index, the post pages, the nav link and the sitemap all follow.
 *
 * A post needs `draft: false` to appear even once the blog is switched on.
 */
const writing = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/writing" }),
  schema: z.object({
    title: z.string().min(1).max(90),

    /** Plain text, used for the listing, social cards and structured data. */
    summary: z.string().min(40).max(320),

    /** Publication date. Drives ordering and the visible dateline. */
    published: z.coerce.date(),

    /** Set when a post is meaningfully revised. Feeds dateModified. */
    updated: z.coerce.date().optional(),

    /** A handful of subjects. Kept plain: there are no tag archive pages. */
    topics: z.array(z.string().min(2).max(30)).max(5).default([]),

    draft: z.boolean().default(true),
  }),
});

export const collections = { projects, writing };
