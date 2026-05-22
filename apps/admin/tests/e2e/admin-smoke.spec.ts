import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Admin app smoke tests', () => {
  test('dashboard loads for admin user', async ({ page }) => {
    await signInAndNavigate(page, '/')
    await expect(page.locator('text=Memberry Admin')).toBeVisible()
  })

  test('non-admin user cannot access admin dashboard', async ({ page }) => {
    // Navigate without signing in — admin content should not render
    await page.goto('http://localhost:3003/', { waitUntil: 'domcontentloaded' })
    // Admin sidebar/dashboard must NOT be visible (auth guard blocks rendering)
    await expect(page.locator('text=Platform Admin')).not.toBeVisible({ timeout: 10000 })
  })
})
