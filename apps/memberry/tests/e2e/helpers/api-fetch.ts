import type { Page } from '@playwright/test'
import { API_BASE } from './test-config'

/**
 * Issue an authenticated, CSRF-aware fetch from inside the page context.
 *
 * Why this exists: many E2E specs poke the API directly via
 * `page.evaluate(() => fetch(...))` to set up state without driving full UI
 * flows. After hono/csrf landed (services/api-ts/src/middleware/csrf.ts),
 * state-changing requests need:
 *   - a fresh `x-csrf-token` header (paired with the better-auth.csrf_token cookie)
 *   - an `Origin` header matching CORS_ORIGINS (Playwright provides this when
 *     the page has navigated to the SPA first)
 *   - `credentials: 'include'` so the session cookie travels
 *
 * Org-scoped routes additionally need `x-org-id`.
 *
 * Returns `{ status, data, csrfToken }` so callers can re-use the token.
 */
export async function apiFetch<T = unknown>(
  page: Page,
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    orgId?: string
  } = {},
): Promise<{ status: number; data: T | null }> {
  return page.evaluate(
    async ({ apiBase, path, init }) => {
      // 1. mint a CSRF token (sets cookie, returns header value)
      const csrfRes = await fetch(`${apiBase}/csrf-token`, { credentials: 'include' })
      const { token } = (await csrfRes.json()) as { token: string }

      // 2. fire the real request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      }
      if (init.orgId) headers['x-org-id'] = init.orgId

      const res = await fetch(`${apiBase}${path}`, {
        method: init.method ?? 'GET',
        credentials: 'include',
        headers,
        body: init.body != null ? JSON.stringify(init.body) : undefined,
      })
      const data = await res.json().catch(() => null)
      return { status: res.status, data }
    },
    { apiBase: API_BASE, path, init },
  ) as Promise<{ status: number; data: T | null }>
}
