/**
 * Build a regex that decides whether an E2E spec exercises a given route.
 *
 * The original Matrix-C matcher required a literal `page.goto("/exact/path")`.
 * Real specs reach routes three ways: `page.goto(...)`, a nav helper
 * (`signInAndNavigate(page, '/audit')`), and data-driven `path:` arrays
 * (`path: \`/org/pda/officer/finances/invoices\``). Requiring `page.goto`
 * mis-flagged the latter two as MISSING — a large false-positive class that
 * would otherwise drive redundant spec-writing.
 *
 * This matcher looks for the route path inside ANY string literal, terminated
 * at a path boundary. `$param` segments become `[^/'"`]+` so a templated id
 * (`/members/${memberId}`) still matches `/members/$personId`.
 *
 * Returns null for routes too short or generic to match safely (the index `/`,
 * which would otherwise match every quoted string containing a slash).
 */
export function buildRouteMatcher(urlPath: string): RegExp | null {
  // Index routes carry a trailing slash (`/audit/`) that won't match the literal
  // `'/audit'` a spec actually navigates to. Strip it before building.
  urlPath = urlPath.replace(/\/$/, '')
  if (urlPath === '' || urlPath === '/' || urlPath.length < 3) return null
  const pattern = urlPath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\$\w+/g, '[^/\'"`]+')
  // Opening quote, optional prefix within the same literal, the path, then a
  // path boundary (slash, query, or the closing quote).
  return new RegExp(`['"\`][^'"\`]*${pattern}(?:[/?'"\`]|$)`)
}
