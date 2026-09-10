import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://abbasalikhan.com';

export default defineConfig({
  site: SITE,

  /**
   * One canonical URL shape. This must agree with the canonical tag and with the
   * host's redirect rules, or the apex and the slashed form both answer 200 and
   * the entity home is duplicated.
   */
  trailingSlash: 'always',

  build: {
    /**
     * Inline every stylesheet into the document. The whole site's CSS is a few
     * kilobytes, so inlining removes the render-blocking request entirely and the
     * page paints from a single round trip. The inline <style> is then hashed into
     * the CSP by scripts/csp-hashes.mjs, so this costs nothing in policy strength.
     */
    inlineStylesheets: 'always',
    assets: '_astro',
  },

  /**
   * Fonts are downloaded at build time and served from this origin. Nothing is
   * requested from Google at runtime, which removes a third-party origin from the
   * critical path and lets font-src stay 'self'.
   *
   * `optimizedFallbacks` is left on: Astro measures each face and writes a
   * metric-matched local fallback, so the swap from fallback to webfont does not
   * move any text and CLS stays at zero.
   */
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Bodoni Moda',
      cssVariable: '--font-display',
      // Variable range. 500 is the floor on a dark ground; 600 is the folio.
      weights: ['500 600'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Didot', 'Hoefler Text', 'Times New Roman', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Archivo',
      cssVariable: '--font-text',
      weights: ['400 600'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
    },
  ],

  integrations: [
    sitemap({
      lastmod: new Date(),
      /**
       * Pages that carry `noindex` must not be advertised in the sitemap:
       * telling a crawler to fetch a page and then telling it not to index the
       * page is a contradiction, and it wastes crawl budget on a one-page site.
       */
      filter: (page) => !/\/(thanks|404)\/?$/.test(new URL(page).pathname),
      serialize: (item) => ({
        ...item,
        // The apex is the entity home; everything else sits below it.
        priority: new URL(item.url).pathname === '/' ? 1.0 : 0.7,
        changefreq: 'monthly',
      }),
    }),
  ],

  /** Strip comments and collapse whitespace in the emitted HTML. */
  compressHTML: true,

  prefetch: false,

  devToolbar: { enabled: false },

  vite: {
    build: {
      // The site ships no client-side framework, so nothing needs a modern-only target.
      cssMinify: 'lightningcss',
    },
  },
});
