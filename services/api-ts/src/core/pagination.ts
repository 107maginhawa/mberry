/**
 * Pagination convention (S-C4-010).
 *
 * Canonical page-size constants used across handlers and repos. Mirrors
 * the safety cap in `core/database.repo.ts` (`DEFAULT_QUERY_LIMIT`) and
 * documents the upper bound a caller may ever request.
 *
 * See `docs/product/PERFORMANCE.md` → "Pagination Convention" for the
 * full rationale.
 */

/**
 * Default page size for `findMany` calls that do not pass an explicit
 * `limit`. Must match `DEFAULT_QUERY_LIMIT` in `database.repo.ts` (the
 * `pagination-convention.test.ts` asserts the equality).
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Hard upper bound for a single page. Handlers should clamp incoming
 * `limit` query params to this value to prevent abusive page sizes from
 * loading entire tables in one request.
 */
export const MAX_PAGE_SIZE = 500;

/**
 * Clamp an arbitrary requested page size into [1, MAX_PAGE_SIZE]. Useful
 * for handlers that accept `?limit=` from clients.
 */
export function clampPageSize(requested: number | undefined): number {
  if (requested === undefined || Number.isNaN(requested)) return DEFAULT_PAGE_SIZE;
  if (requested < 1) return 1;
  if (requested > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return Math.floor(requested);
}
