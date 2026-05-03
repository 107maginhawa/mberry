// Phase 3: Cross-role tests
// Verifies access control in browser, not just API
import { test, expect } from '../helpers/test-fixture'
import { signIn, signUp } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Cross-Role Access Control', () => {
  test('fresh signup user: no officer link on dashboard', async ({ page }) => {
    await signUp(page)
    await page.goto('/dashboard')
    await expect(page.getByText(/Good/i).first()).toBeVisible({ timeout: 10000 })

    // Should NOT show any "Officer Dashboard" or "President Dashboard" link
    const hasOfficerLink = await page.getByText(/Officer Dashboard|President Dashboard/i).isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasOfficerLink).toBeFalsy()
  })

  test('fresh signup user: officer route redirects away', async ({ page }) => {
    await signUp(page)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForTimeout(3000)

    // Should NOT be on officer dashboard
    expect(page.url()).not.toContain('/officer/dashboard')
  })

  test('officer user: officer link visible on dashboard', async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
    await page.goto('/dashboard')
    await expect(page.getByText(/President Dashboard/i)).toBeVisible({ timeout: 10000 })
  })
})
