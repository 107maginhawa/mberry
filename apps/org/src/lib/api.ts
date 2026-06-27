import { client } from '@monobase/sdk-ts/generated/client.gen'

// Engine CSRF allowlist (services/api-ts/src/app.ts): these prefixes skip the
// double-submit check, so we must NOT attach a token (and must not block on
// fetching one) for them.
const CSRF_EXEMPT_PREFIXES = ['/auth/', '/pay/', '/webhooks/', '/billing/webhooks/', '/email/unsubscribe', '/test/', '/csrf-token']
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
      .then((b: { token: string }) => { csrfToken = b.token; return b.token })
      .finally(() => { inflight = null })
  }
  return inflight
}

function needsCsrf(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  return !CSRF_EXEMPT_PREFIXES.some((p) => pathname.includes(p))
}

/**
 * Configure the shared SDK client for the authed officer app:
 *  - send the session cookie on every request (credentials:'include')
 *  - mirror the CSRF cookie token into the x-csrf-token header on mutating,
 *    non-allowlisted requests (engine double-submit, csrf-token.ts).
 * On a 403 we clear the cached token so the next attempt refetches it.
 * ponytail: clear-on-403, no auto-retry — token is long-lived; a single re-tap
 *           recovers the rare mid-session expiry. Add retry only if it bites.
 */
export function configureApiClient(baseUrl = `${window.location.origin}/api`): void {
  client.setConfig({ baseUrl, credentials: 'include' })

  client.interceptors.request.use(async (request: Request) => {
    const { pathname } = new URL(request.url)
    // Org-scoped read endpoints (dues-*) gate on the x-org-id header (org-context.ts).
    // Inject the selected org by default so callers don't each thread it.
    const orgId = localStorage.getItem('org.selectedOrgId')
    if (orgId && !request.headers.has('x-org-id')) request.headers.set('x-org-id', orgId)
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
