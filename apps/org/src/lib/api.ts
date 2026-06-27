import { client } from '@monobase/sdk-ts/generated/client.gen'

// Engine CSRF allowlist — must track services/api-ts/src/app.ts:275-282.
// These prefixes skip the double-submit check on the server side; we must NOT
// attach a token (or block on fetching one) for them.
// /csrf-token is GET (safe-method exempt on the engine) but listed here to
// keep the client's path check explicit.
const CSRF_EXEMPT_PREFIXES = [
  '/auth/',
  '/pay/',
  '/webhooks/',
  '/billing/webhooks/',
  '/email/unsubscribe',
  '/test/',
  '/csrf-token',
]
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let csrfToken: string | null = null
let inflight: Promise<string> | null = null

/** Test-only: clear the module-level CSRF cache between tests. */
export function resetCsrfCacheForTest(): void {
  csrfToken = null
  inflight = null
}

async function getCsrfToken(baseUrl: string): Promise<string> {
  if (csrfToken) return csrfToken
  if (!inflight) {
    inflight = fetch(`${baseUrl}/csrf-token`, { credentials: 'include' })
      .then((r) => r.json())
      .then((b: { token: string }) => {
        if (typeof b?.token !== 'string') throw new Error('CSRF endpoint returned no token')
        csrfToken = b.token
        return b.token
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

// The engine matches exemptions against the pathname WITHOUT the /api prefix
// (Vite proxy strips it before the request reaches the engine). Our baseUrl
// is origin+/api, so we strip that prefix here to match the engine's view.
// MUST track services/api-ts/src/app.ts:275-282 — if the server allowlist
// changes, update CSRF_EXEMPT_PREFIXES above.
function needsCsrf(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  const p = pathname.replace(/^\/api(?=\/)/, '') // strip /api prefix → engine view
  return !CSRF_EXEMPT_PREFIXES.some((prefix) => p.startsWith(prefix))
}

function isExemptPath(pathname: string): boolean {
  const p = pathname.replace(/^\/api(?=\/)/, '')
  return CSRF_EXEMPT_PREFIXES.some((prefix) => p.startsWith(prefix))
}

/**
 * Single source of truth for the API base URL — used by both configureApiClient
 * and the sign-in raw fetch so they can never drift.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`

/**
 * Configure the shared SDK client for the authed officer app:
 *  - send the session cookie on every request (credentials:'include')
 *  - mirror the CSRF cookie token into the x-csrf-token header on mutating,
 *    non-allowlisted requests (engine double-submit, csrf-token.ts).
 * On a 403 we clear the cached token so the next attempt refetches it.
 * Idempotent: clears existing interceptors before registering, safe under HMR.
 * ponytail: clear-on-403, no auto-retry — token is long-lived; a single re-tap
 *           recovers the rare mid-session expiry. Add retry only if it bites.
 */
export function configureApiClient(baseUrl = API_BASE): void {
  // Clear before registering so repeated calls (HMR, tests) don't stack duplicates.
  client.interceptors.request.clear()
  client.interceptors.response.clear()

  client.setConfig({ baseUrl, credentials: 'include' })

  client.interceptors.request.use(async (request: Request) => {
    const { pathname } = new URL(request.url)
    // Org-scoped read endpoints (dues-*) gate on the x-org-id header (org-context.ts).
    // Inject the selected org only on org-scoped paths (not /auth or /pay public flows).
    if (!isExemptPath(pathname)) {
      const orgId = localStorage.getItem('org.selectedOrgId')
      if (orgId && !request.headers.has('x-org-id')) request.headers.set('x-org-id', orgId)
    }
    if (needsCsrf(request.method, pathname)) {
      request.headers.set('x-csrf-token', await getCsrfToken(baseUrl))
    }
    return request
  })

  client.interceptors.response.use((response: Response) => {
    if (response.status === 403) csrfToken = null
    return response
  })
}
