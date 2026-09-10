import { site, sameAs, absoluteUrl } from '../site.config';
import type { Project } from './projects';

/**
 * STRUCTURED DATA
 * ===============
 * One JSON-LD `@graph` per page, built here and nowhere else.
 *
 * The rule that governs this file: the Person node is byte-identical on every
 * page and always carries the same `@id`. Two Person nodes with different `@id`s
 * split the entity in half, which is the most common way a personal-brand schema
 * fails. Repeating the identical node is safe and merges; varying it is not.
 *
 * The entity home is the apex, `https://abbasalikhan.com/`. Every profile,
 * citation and backlink resolves there. It must never move to a subpage, even
 * now that subpages exist.
 */

const PERSON_ID = `${site.url}/#person`;
const WEBSITE_ID = `${site.url}/#website`;

/** Wikidata entities, anchoring the person to places a search engine knows. */
const WIKIDATA = {
  melbourne: 'https://www.wikidata.org/wiki/Q3141',
  australia: 'https://www.wikidata.org/wiki/Q408',
} as const;

const pageId = (path: string) => `${absoluteUrl(path)}#webpage`;

/** The canonical Person. Identical on every page, by design. */
function personNode() {
  const { identity, seo } = site;
  const loc = identity.location;

  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: identity.name,
    alternateName: [...identity.alternateNames],
    givenName: 'Abbas',
    familyName: 'Khan',
    jobTitle: identity.role,
    description: seo.description,
    /**
     * A well-known Pakistani vocalist and a Bangladeshi politician share this
     * name, both with Wikipedia articles. This states plainly which person the
     * site is about rather than leaving a search engine to guess.
     */
    disambiguatingDescription: `${identity.name} the software engineer based in ${loc.city}, ${loc.country}, who designs and ships his own apps. Not the Pakistani singer-songwriter or the Bangladeshi politician of the same name.`,
    url: `${site.url}/`,
    mainEntityOfPage: { '@id': pageId('/') },
    address: {
      '@type': 'PostalAddress',
      addressLocality: loc.city,
      addressRegion: loc.regionCode,
      addressCountry: loc.countryCode,
    },
    homeLocation: {
      '@type': 'Place',
      name: `${loc.city}, ${loc.country}`,
      sameAs: WIKIDATA.melbourne,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: loc.latitude,
        longitude: loc.longitude,
      },
    },
    workLocation: {
      '@type': 'Place',
      name: `${loc.city}, ${loc.country}`,
      sameAs: WIKIDATA.melbourne,
    },
    nationality: { '@type': 'Country', name: loc.country, sameAs: WIKIDATA.australia },
    knowsAbout: [...identity.knowsAbout],
    knowsLanguage: ['en-AU'],
    hasOccupation: {
      '@type': 'Occupation',
      name: identity.role,
      occupationLocation: { '@type': 'City', name: loc.city, sameAs: WIKIDATA.melbourne },
      skills: [...identity.knowsAbout],
    },
  };

  /** An identity assertion, not a link list. See the warning in site.config.ts. */
  if (sameAs.length > 0) person.sameAs = sameAs;
  if (identity.portrait.image) {
    person.image = {
      '@type': 'ImageObject',
      url: absoluteUrl(identity.portrait.image.src),
      width: identity.portrait.image.width,
      height: identity.portrait.image.height,
      caption: identity.portrait.alt,
    };
  }
  if (identity.email) person.email = `mailto:${identity.email}`;

  return person;
}

function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${site.url}/`,
    name: site.identity.name,
    alternateName: site.domain,
    description: site.seo.description,
    inLanguage: site.seo.locale,
    publisher: { '@id': PERSON_ID },
    copyrightHolder: { '@id': PERSON_ID },
  };
}

/** Breadcrumbs from a trail of [name, path] pairs. Home is added for you. */
function breadcrumb(trail: Array<[string, string]>) {
  const items = [['Home', '/'] as [string, string], ...trail];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

/** One project as a SoftwareApplication. */
function applicationNode(project: Project) {
  const app: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${absoluteUrl(`/work/${project.id}/`)}#app`,
    name: project.data.title,
    alternateName: project.data.tagline,
    description: project.data.summary,
    applicationCategory: project.data.category,
    author: { '@id': PERSON_ID },
    creator: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
    inLanguage: site.seo.locale,
    url: absoluteUrl(`/work/${project.id}/`),
  };

  const os = project.data.platforms.map((p) => p.trim()).filter(Boolean);
  if (os.length > 0) app.operatingSystem = os;

  // A bare year is valid ISO 8601, and is the only date knowable here. It is
  // not shown to a reader anywhere; it exists to place the work in time.
  const year = project.data.year ? /^(\d{4})/.exec(project.data.year)?.[1] : undefined;
  if (year) app.datePublished = year;

  if (project.data.links.length > 0) app.sameAs = project.data.links.map((l) => l.href);

  return app;
}

interface PageOptions {
  /** ISO 8601, generated at build time so it never rots into a lie. */
  modified: string;
}

/** The entity home. The only page that carries the full ProfilePage. */
export function buildHomeGraph({ modified, projects }: PageOptions & { projects: Project[] }) {
  const list = {
    '@type': 'ItemList',
    '@id': `${site.url}/#projects`,
    name: `Apps built by ${site.identity.name}`,
    numberOfItems: projects.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: projects.map((project, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/work/${project.id}/`),
      name: project.data.title,
    })),
  };

  /**
   * ProfilePage rather than WebPage: the type is scoped to pages where a creator
   * shares a first-hand perspective, which the practice note is. No
   * `interactionStatistic` is emitted, because those must come from a platform
   * that hosts the profile and inventing them is both invalid and not worth it.
   */
  return graph([
    personNode(),
    websiteNode(),
    {
      '@type': 'ProfilePage',
      '@id': pageId('/'),
      url: `${site.url}/`,
      name: site.seo.title,
      description: site.seo.description,
      inLanguage: site.seo.locale,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      mainEntity: { '@id': PERSON_ID },
      dateModified: modified,
      breadcrumb: breadcrumb([]),
    },
    list,
  ]);
}

/** /work/ - the catalogue. */
export function buildWorkGraph({ modified, projects }: PageOptions & { projects: Project[] }) {
  return graph([
    personNode(),
    websiteNode(),
    {
      '@type': 'CollectionPage',
      '@id': pageId('/work/'),
      url: absoluteUrl('/work/'),
      name: `Work by ${site.identity.name}`,
      description: site.sections.work.lede,
      inLanguage: site.seo.locale,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      dateModified: modified,
      breadcrumb: breadcrumb([['Work', '/work/']]),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: projects.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: projects.map((project, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(`/work/${project.id}/`),
          name: project.data.title,
        })),
      },
    },
  ]);
}

/** /work/<slug>/ - the page that lets a project rank for its own name. */
export function buildProjectGraph({ modified, project }: PageOptions & { project: Project }) {
  const path = `/work/${project.id}/`;
  return graph([
    personNode(),
    websiteNode(),
    applicationNode(project),
    {
      '@type': 'WebPage',
      '@id': pageId(path),
      url: absoluteUrl(path),
      name: `${project.data.title} by ${site.identity.name}`,
      description: project.data.summary,
      inLanguage: site.seo.locale,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      mainEntity: { '@id': `${absoluteUrl(path)}#app` },
      dateModified: modified,
      breadcrumb: breadcrumb([
        ['Work', '/work/'],
        [project.data.title, path],
      ]),
    },
  ]);
}

/** /about/ */
export function buildAboutGraph({ modified }: PageOptions) {
  return graph([
    personNode(),
    websiteNode(),
    {
      '@type': 'AboutPage',
      '@id': pageId('/about/'),
      url: absoluteUrl('/about/'),
      name: `About ${site.identity.name}`,
      description: site.sections.about.lede,
      inLanguage: site.seo.locale,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      mainEntity: { '@id': PERSON_ID },
      dateModified: modified,
      breadcrumb: breadcrumb([['About', '/about/']]),
    },
  ]);
}

/** A page with nothing to say about itself: 404, thanks. */
export function buildPlainGraph({ modified, path, name }: PageOptions & { path: string; name: string }) {
  return graph([
    personNode(),
    websiteNode(),
    {
      '@type': 'WebPage',
      '@id': pageId(path),
      url: absoluteUrl(path),
      name,
      inLanguage: site.seo.locale,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      dateModified: modified,
    },
  ]);
}

function graph(nodes: unknown[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/**
 * Serialises a graph for a `<script type="application/ld+json">` body.
 *
 * `<`, `>` and `&` are escaped so the payload can never terminate the script
 * element, even though every value here is build-time content.
 */
export function serialiseGraph(graphObject: unknown): string {
  return JSON.stringify(graphObject)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
