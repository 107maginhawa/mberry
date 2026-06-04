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
    const hasAnyContent = await page.locator('main, [role="main"], .container, #root > *').first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasAnyContent).toBeTruthy()
  })

  test('org page shows error state for non-existent org', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/org/00000000-0000-0000-0000-000000000000/home')
    // Should show error or redirect — not crash
    const hasError = await page.getByText(/not.*found|error|no.*org|unauthorized/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const redirectedAway = !page.url().includes('00000000-0000-0000-0000-000000000000')
    expect(hasError || redirectedAway).toBeTruthy()
  })
})
