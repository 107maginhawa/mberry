// WF-028 — Org Public Page: URL-friendly public profile
// Business Rules: [BR-29]
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'

test.describe('Public Org Page', () => {
  test('[BR-29] public org page loads without auth', async ({ page }) => {
    // Clear cookies to ensure no auth session
    await page.context().clearCookies()

    const respP = captureAnyApiSuccess(page)
    await page.goto('/join/pda-metro-manila')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    // Should NOT redirect to auth
    expect(page.url()).not.toContain('/auth/')

    // Org name should be displayed
    await expect(
      page.getByText(/pda metro manila/i),
    ).toBeVisible({ timeout: 10000 })

    // A call-to-action should be visible (apply, join, etc.)
    const hasApply = await page.getByText(/apply|join|sign up|register|become a member/i).first().isVisible().catch(() => false)
    const hasContactInfo = await page.getByText(/contact|email|phone/i).first().isVisible().catch(() => false)
    const hasCTA = await page.getByRole('link', { name: /apply|join/i }).first().isVisible().catch(() => false)
    expect(hasApply || hasContactInfo || hasCTA).toBeTruthy()
  })
})
