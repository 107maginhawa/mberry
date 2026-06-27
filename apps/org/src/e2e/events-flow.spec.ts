import { test, expect } from '@playwright/test'

// Auth + officer gated. Run against a seeded signed-in officer stack. Self-skips otherwise.
test('officer can open the create-event form', async ({ page }) => {
  await page.goto('/events')
  // __root redirect is an async effect — wait for the app to settle before asserting.
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/create event/i).first()).toBeVisible()
  await expect(page.getByLabel(/^title/i)).toBeVisible()
})
