import { test, expect } from '@playwright/test'

test('dashboard shows the upcoming events tile', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/upcoming events/i)).toBeVisible()
})
