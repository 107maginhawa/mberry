/**
 * Slug generation and uniqueness utilities for organizations.
 *
 * Slugs are globally unique, URL-safe identifiers derived from org names.
 * Once created, slugs are immutable to avoid broken public links.
 */

import type { OrganizationRepository } from '../repos/platform-admin.repo';

/**
 * Generate a URL-safe slug from an organization name.
 * Strips special characters, lowercases, replaces spaces with hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // strip non-alphanumeric except spaces/hyphens
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}

/**
 * Ensure slug uniqueness by appending a numeric suffix if needed.
 * Checks against existing slugs in the database.
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  repo: OrganizationRepository,
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (await repo.findBySlug(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return candidate;
}
