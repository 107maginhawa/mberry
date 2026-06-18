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
];

/**
 * The only public endpoint under `/directory/search` is the per-person
 * public profile view: `/association/member/directory/search/:personId/public`.
 * The bare `/directory/search` is the AUTHENTICATED member directory search
 * and must NOT be exempted (it needs auth + org-context to set orgMembership).
 */
const DIRECTORY_PUBLIC_PROFILE =
  /^\/association\/member\/directory\/search\/[^/]+\/public$/;

/**
 * True when `path` is a public association endpoint.
 *
 * Matches the exact path OR a sub-path under it (the public path followed by
 * `/`), so `/association/member/directory/search/:personId/public` is exempt
 * while `/association/member/directory/searchInternal` is not.
 */
export function isAssociationPublicPath(path: string): boolean {
  if (DIRECTORY_PUBLIC_PROFILE.test(path)) return true;
  return ASSOCIATION_PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}
