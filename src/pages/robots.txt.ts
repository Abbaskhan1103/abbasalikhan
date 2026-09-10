import type { APIRoute } from 'astro';
import { SITE_URL } from '../site.config';

/**
 * Everything is allowed, including the AI crawlers.
 *
 * Blocking GPTBot, ClaudeBot and the rest is a common reflex, and for an entity
 * whose whole problem is being confused with two other people who share the
 * name, it is the wrong one: those crawlers feed the answer surfaces where
 * "who is X" questions actually get resolved. Being absent there does not
 * protect the entity, it just leaves the disambiguation to someone else.
 */
const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`;

export const GET: APIRoute = () =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
