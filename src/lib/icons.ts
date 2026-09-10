import type { IconName } from '../components/Icon.astro';

/**
 * Maps a platform string from a project's frontmatter to an icon.
 *
 * Unknown platforms return null and simply render as text, so adding a
 * platform never has to mean adding an icon first.
 */
export function platformIcon(platform: string): IconName | null {
  const key = platform.trim().toLowerCase();
  if (key.startsWith('ios') || key.startsWith('ipad') || key.startsWith('mac') || key.startsWith('watch') || key.startsWith('visio')) {
    return 'apple';
  }
  if (key.startsWith('android')) return 'android';
  if (key.startsWith('windows')) return 'windows';
  if (key.startsWith('web') || key.startsWith('browser')) return 'web';
  return null;
}

/** Maps a skills group label to an icon. Unknown labels render without one. */
export function skillIcon(label: string): IconName | null {
  const key = label.trim().toLowerCase();
  const map: Record<string, IconName> = {
    building: 'build',
    design: 'design',
    ai: 'ai',
    automation: 'automation',
    domains: 'domain',
  };
  return map[key] ?? null;
}
