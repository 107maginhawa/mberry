/**
 * CSRF double-submit token helper.
 *
 * The API CSRF middleware (Wave G4) requires every state-changing request to
 * carry both:
 *   - a `csrf_token` cookie (set by the API via `GET /csrf-token`)
 *   - an `x-csrf-token` request header whose value matches the cookie
 *
 * The cookie is NOT HttpOnly so the SDK on the same origin can read it. This
 * helper centralises both seeding the cookie and reading it for header
 * injection from both the hey-api generated client and the custom HttpTransport.
 */

export const CSRF_HEADER = 'x-csrf-token'
export const CSRF_COOKIE = 'csrf_token'
export const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Read the current csrf_token cookie value, if present.
 *
 * Returns null in non-DOM environments (SSR, tests) and when no cookie is set.
 */
export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie || ''
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const name = trimmed.slice(0, eq)
    if (name === CSRF_COOKIE) return decodeURIComponent(trimmed.slice(eq + 1))
  }
  return null
}

/**
 * Whether a request method requires CSRF protection.
 */
export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase())
}

/**
 * Seed the csrf_token cookie by calling GET /csrf-token on the configured API.
 *
 * Safe to call on every mount: the API rotates the token each time, but any
 * subsequent state-changing request reads the latest cookie at send time.
 * Failures are swallowed — the next state-changing request will surface the
 * upstream CSRF_TOKEN_MISSING error if seeding actually failed.
 */
export async function seedCsrfToken(apiBaseUrl: string): Promise<void> {
  if (typeof fetch === 'undefined') return
  try {
    await fetch(`${apiBaseUrl.replace(/\/$/, '')}/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    // Intentional: silent failure. State-changing requests will retry seeding
    // implicitly via the gate in client.ts.
  }
}
