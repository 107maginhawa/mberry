import { test, expect } from '@playwright/test'

test.describe('Account app activation', () => {
  test('landing page renders for unauthenticated user', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Assert homepage hero content is visible
    await expect(page.locator('body')).toContainText('Your Complete Service Management Platform')
  })

  test('auth redirect works — sign-in page loads', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.waitForLoadState('networkidle')

    // Assert sign-in form is visible
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })
})
