import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Admin app smoke tests', () => {
  test('dashboard loads for admin user', async ({ page }) => {
    await signInAndNavigate(page, '/')
    await expect(page.locator('text=Memberry Admin')).toBeVisible()
  })

  test('non-admin user gets redirected', async ({ page }) => {
    // Navigate without signing in — should redirect to memberry login
    await page.goto('http://localhost:3003/')
    // Should redirect away from admin
    await page.waitForURL(/sign-in|localhost:3004/, { timeout: 10000 })
  })
})
