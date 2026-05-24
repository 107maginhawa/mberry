/**
 * Event slug generation utilities.
 * Reuses the same algorithm as platformadmin/utils/slug.ts.
 * Slugs are globally unique (not per-org) because /public/events/:slug is a global route.
 * Immutable after first save — title changes don't update the slug.
 */

import type { EventsRepository } from '../repos/events.repo';

/**
 * Generate a URL-safe slug from an event title.
 */
export function generateEventSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure slug uniqueness by appending a numeric suffix if needed.
 */
export async function ensureUniqueEventSlug(
  baseSlug: string,
  repo: EventsRepository,
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (await repo.findBySlug(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return candidate;
}
