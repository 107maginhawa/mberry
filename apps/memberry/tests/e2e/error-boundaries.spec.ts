// @selector-only-ok: error-boundary spec — intercepts/forges API failures and asserts graceful UI; capturing a real-flow response would just match the forged 500
// Error boundary tests — verify graceful degradation when API fails
// Uses page.route() to intercept API and return 500
import { test, expect } from './helpers/test-fixture'
import { signInAsMember } from './helpers/auth'

test.describe('Error Boundaries', () => {
  // Allow API 5xx since we deliberately cause them in these tests
  test.use({ allowApiFailures: [/→ 500/, /→ 404/] })

  test('dashboard shows error state when API returns 500', async ({ page }) => {
    await signInAsMember(page)

    // Intercept API calls to return 500
    await page.route('**/api/**', async (route) => {
      // Only intercept GET requests to data endpoints
      if (route.request().method() === 'GET' && !route.request().url().includes('/auth/')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/dashboard')
    // Page should render (not crash) — show error state, not blank screen
    const body = page.locator('body')
    const bodyText = await body.textContent()
    expect(bodyText?.length).toBeGreaterThan(0)

    // Error boundary or empty state is acceptable — blank white page is not
    await expect(page.locator('main, [role="main"], .container, #root > *').first()).toBeVisible({ timeout: 5000 })
  })

  test('org page shows error state for non-existent org', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/org/00000000-0000-0000-0000-000000000000/home')
    // Should show error or redirect — not crash
    // isVisible() does not retry — poll the combined visibility/redirect
    // state until the SPA settles into an error or redirect.
    await expect(async () => {
      const hasError = await page
        .getByText(/not.*found|error|no.*org|unauthorized/i)
        .first()
        .isVisible()
        .catch(() => false)
      const redirectedAway = !page.url().includes('00000000-0000-0000-0000-000000000000')
      expect(hasError || redirectedAway).toBe(true)
    }).toPass({ timeout: 10000 })
  })
})
