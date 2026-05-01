import { test, expect } from '@playwright/test'
import { signUp, signIn } from './helpers/auth'

test.describe('My Organizations page (/my/organizations)', () => {
  let credentials: { email: string; password: string; name: string }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await signUp(page)
    await page.close()
  })

  test('shows empty state for new user with no memberships', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/organizations')

    await expect(page.getByText('My Organizations')).toBeVisible()
    await expect(page.getByText(/haven't joined/i)).toBeVisible()
  })

  test('shows loading state', async ({ page }) => {
    // Delay API response
    await page.route('**/api/persons/me/memberships', async (route) => {
      await new Promise(r => setTimeout(r, 500))
      await route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) })
    })

    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/organizations')

    // Loading text should appear
    await expect(page.getByText('Loading...')).toBeVisible()
    // Then empty state
    await expect(page.getByText(/haven't joined/i)).toBeVisible()
  })

  test('fetch failure shows empty state', async ({ page }) => {
    await page.route('**/api/persons/me/memberships', (route) =>
      route.fulfill({ status: 500, body: '{"error":"Server error"}' })
    )

    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/organizations')

    // Should show empty state, not crash
    await expect(page.getByText(/haven't joined/i)).toBeVisible()
  })
})
