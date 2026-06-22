import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

function captureAnyApiSuccess(page: import('@playwright/test').Page, timeout = 20000) {
  return page
    .waitForResponse(
      (r) => r.url().includes('/api/') && r.request().method() === 'GET' && r.status() < 400,
      { timeout },
    )
    .catch(() => null)
}

// The admin app holds open the Vite HMR socket in dev mode, so
// page.waitForLoadState('networkidle') never settles. Wait for DOM ready and
// assert the page's REAL content rendered — not just that <main> exists.
//
// R1-4: `main` visible is too weak. A blank-render regression (e.g. the
// `createFileRoute('/surveys/' as any)` cast that wiped the admin SPA in dev)
// can leave a shell while rendering nothing. Each page renders its title as an
// <h1> via PageShell, so asserting the real heading text proves the route
// mounted AND its component rendered. The route-gen blind spot itself is now
// caught structurally by `bun run --filter admin check:routes` in CI; these
// assertions are the e2e half (real content, plus a real data row where the
// seed guarantees one).
test.describe('Admin route coverage (Phase 4 gap fill)', () => {
  test('feature-flags page loads its real content', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await signInAndNavigate(page, '/feature-flags')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    // Real content: the page-title <h1>, not just a shell.
    await expect(page.getByRole('heading', { name: 'Feature Flags', level: 1 })).toBeVisible({
      timeout: 15000,
    })
  })

  test('operators page renders a real, non-empty operator row', async ({ page }) => {
    await signInAndNavigate(page, '/operators')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Operators', level: 1 })).toBeVisible({
      timeout: 15000,
    })
    // Non-empty data row: the account we authenticated as is a platform_admin,
    // so it MUST appear in the operators list. This asserts the data layer
    // actually rendered a row (not the "No operators found." empty state), which
    // a blank/partial render would fail.
    await expect(page.getByText('No operators found.')).not.toBeVisible()
    // Scope to the table cell — the email also appears in the sidebar user menu.
    await expect(page.getByRole('cell', { name: 'test@memberry.ph' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('impersonate page loads its real content', async ({ page }) => {
    await signInAndNavigate(page, '/impersonate')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Impersonate User', level: 1 })).toBeVisible({
      timeout: 15000,
    })
  })
})
