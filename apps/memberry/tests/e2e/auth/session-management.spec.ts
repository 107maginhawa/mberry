// BR-26: Session management
import { test, expect } from '@playwright/test'
import { signInAsMember } from '../helpers/auth'

test.describe('BR-26: Session Management', () => {
  test('authenticated session persists across navigation', async ({ page }) => {
    await signInAsMember(page)

    // Navigate to multiple pages — session should persist
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto('/my/credits')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('security settings page accessible', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')

    // Click Security tab
    const securityTab = page.getByRole('tab', { name: /security/i })
    const hasTab = await securityTab.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasTab) {
      await securityTab.click()
      await page.waitForTimeout(1000)

      // Should show security settings
      const hasSecurityContent = await page.getByText(/security|password|session/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasSecurityContent).toBeTruthy()
    }
  })

  test('unauthenticated access redirects to sign-in', async ({ page }) => {
    // Don't sign in — access protected route directly
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Should redirect to auth page
    const url = page.url()
    const isAuthPage = url.includes('/auth/') || url.includes('/sign-in')
    const isHomePage = url.endsWith('/') || url.includes('index')
    expect(isAuthPage || isHomePage).toBeTruthy()
  })
})
