/**
 * Public `/association/*` endpoints that must bypass auth + org-context
 * middleware (credential verification, public directory, ethics complaints).
 *
 * Centralized here so the exemption predicate is unit-testable and matched on
 * full path-segment boundaries (FIX-009): a `startsWith` prefix match could
 * accidentally exempt a sibling route (e.g. `/public-verify-admin` under the
 * `/public-verify` entry, or `/searchInternal` under `/search`).
 */
export const ASSOCIATION_PUBLIC_PATHS = [
  '/association/member/credentials/public-verify',
  '/association/member/credentials/lookup',
  '/association/member/ethics/public-complaints',
  '/association/member/ethics/public-complaint',
  '/association/member/directory/public',
  '/association/member/directory/search', // covers /search/:personId/public
];

/**
 * True when `path` is a public association endpoint.
 *
 * Matches the exact path OR a sub-path under it (the public path followed by
 * `/`), so `/association/member/directory/search/:personId/public` is exempt
 * while `/association/member/directory/searchInternal` is not.
 */
export function isAssociationPublicPath(path: string): boolean {
  return ASSOCIATION_PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}
