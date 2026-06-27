import { test, expect } from '@playwright/test'

// Auth-gated route. Run against a seeded, signed-in stack. The controller verifies
// this spec runs; when stack/seed is unavailable it is allowed to be skipped, not faked.
test('digital card page shows the card and a QR', async ({ page }) => {
  await page.goto('/card')
  // If redirected to sign-in (no session in CI), skip — covered by unit tests.
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/digital card/i)).toBeVisible()
  await expect(page.locator('svg').first()).toBeVisible()
})
