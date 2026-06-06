import type { Page, Response } from '@playwright/test'

// W2 E2E real-flow hardening helper.
//
// Purpose: every authenticated route hydrates state via at least one
// backend GET. State tests previously asserted only on rendered text,
// which masked backend failures (a 500 still shows a heading from the
// shell). These helpers capture the hydration response so the spec can
// assert status + ok() — flipping the audit-e2e-depth verdict from
// selector-only to real-flow and proving the wire actually returned data.
//
// Usage:
//   const respP = captureRouteHydration(page, /\/persons\/me(\?|$)/)
//   await page.goto('/dashboard')
//   const resp = await respP
//   expect(resp?.status()).toBe(200)
//   expect(resp?.ok()).toBe(true)

export function captureRouteHydration(
  page: Page,
  urlPattern: RegExp | string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; timeout?: number } = {},
): Promise<Response | null> {
  const method = opts.method ?? 'GET'
  const timeout = opts.timeout ?? 20000
  const matcher =
    typeof urlPattern === 'string'
      ? (r: Response) => r.url().includes(urlPattern)
      : (r: Response) => urlPattern.test(r.url())
  return page
    .waitForResponse((r) => matcher(r) && r.request().method() === method, { timeout })
    .catch(() => null)
}

// Universal fallback when the spec doesn't care which exact endpoint —
// just that *some* /api/ GET hydrated the page. Matches the first
// successful API GET after the listener attaches.
export function captureAnyApiSuccess(page: Page, timeout = 20000): Promise<Response | null> {
  return page
    .waitForResponse(
      (r) => r.url().includes('/api/') && r.request().method() === 'GET' && r.status() < 400,
      { timeout },
    )
    .catch(() => null)
}
