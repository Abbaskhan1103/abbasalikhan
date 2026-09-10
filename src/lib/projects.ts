import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

/**
 * Every project that should appear on the live site, in display order.
 *
 * Drafts are dropped. Ordering is `order` ascending, then title alphabetically,
 * so two projects sharing an `order` still come out in a stable sequence rather
 * than in whatever order the filesystem happened to hand them over.
 */
export async function getProjects(): Promise<Project[]> {
  const entries = await getCollection('projects', ({ data }) => data.draft !== true);

  return entries.sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.title.localeCompare(b.data.title, 'en');
  });
}

/** Zero-padded index for the project list, e.g. 1 -> "01". */
export function projectIndex(position: number): string {
  return String(position + 1).padStart(2, '0');
}
