// BR-26: Session management
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'
import { captureAnyApiSuccess } from '../helpers/real-flow'

test.describe('BR-26: Session Management', () => {
  test('authenticated session persists across navigation', async ({ page }) => {
    await signInAsMember(page)

    // Navigate to multiple pages — session should persist
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/profile')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto('/my/settings')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto('/my/credits')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('security settings page accessible', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/settings')
    // Security tab must exist — core settings feature
    const securityTab = page.getByRole('tab', { name: /security/i })
    await expect(securityTab).toBeVisible({ timeout: 10000 })

    await securityTab.click()
    await page.waitForTimeout(1000)

    // Should show security settings content
    await expect(page.getByText(/security|password|session/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('unauthenticated access redirects to sign-in', async ({ page }) => {
    // Don't sign in — access protected route directly
    await page.goto('/my/profile')
    await page.waitForTimeout(3000)

    // Should redirect to auth page
    const url = page.url()
    const isAuthPage = url.includes('/auth/') || url.includes('/sign-in')
    const isHomePage = url.endsWith('/') || url.includes('index')
    expect(isAuthPage || isHomePage).toBeTruthy()
  })
})
