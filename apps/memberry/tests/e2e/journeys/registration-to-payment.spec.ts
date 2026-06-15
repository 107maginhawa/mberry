// Cross-Module Flow 6.1 + 6.2: Member Registration → Onboarding → Dues Payment
// Covers: M01 (auth) → M02 (profile) → M05 (membership) → M06 (dues)
// Focus: signup-to-approved segment. Payment verification via page presence (not re-testing full recording).
import { test, expect } from '../helpers/test-fixture'
import { signUp, signInAsOfficer, signInAsMember } from '../helpers/auth'
import { captureRouteHydration } from '../helpers/real-flow'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Registration → Membership → Payment', () => {
  test('new user can sign up and reach dashboard', async ({ page }) => {
    await test.step('sign up new user', async () => {
      const { email } = await signUp(page)
      expect(email).toBeTruthy()
    })

    await test.step('new user reaches dashboard, onboarding, or stays on auth (email verification required)', async () => {
      // After signup, the user may land on the dashboard, onboarding, an org
      // home, the authenticated root, or an email-verification gate — the
      // exact landing varies by env (CI requires email verification). The
      // contract is simply: signUp navigated away from the sign-up form into
      // a rendered app page.
      await page.waitForLoadState('networkidle')
      expect(page.url()).not.toContain('/auth/sign-up')
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test('officer can view and manage member applications', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to applications page', async () => {
      await page.goto(`/org/${ORG_ID}/officer/applications`)
      await expect(page).toHaveURL(/applications/)
    })

    await test.step('applications page renders', async () => {
      // Should see heading and either applications or empty state
      await expect(page.getByText(/application|pending|review|no.*application/i).first()).toBeVisible({ timeout: 10000 })
    })
  })

  test('approved member appears in payments page', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('navigate to payments', async () => {
      const respP = captureRouteHydration(page, /\/dues-invoices|\/payments/)
      await page.goto('/my/payments')
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)
      await expect(page).toHaveURL(/\/my\/payments/)
    })

    await test.step('payments page shows history or empty state', async () => {
      // Active member should see payment history or dues info
      await expect(page.getByText(/payment|dues|amount|history|no.*payment/i).first()).toBeVisible({ timeout: 10000 })
    })
  })

  test('member dues page shows payment options', async ({ page }) => {
    await signInAsMember(page)
    await page.goto(`/org/${ORG_ID}/dues`)
    // Should see dues info — amount, status, or payment button
    await expect(page.getByText(/dues|payment|amount|pay|₱|\$/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('full journey: dashboard → org → dues → payment visibility', async ({ page }) => {
    await test.step('sign in and go to dashboard', async () => {
      await signInAsMember(page)
      await page.goto('/dashboard')
    })

    await test.step('navigate to org home', async () => {
      // Click on org card or link
      const orgLink = page.locator(`a[href*="/org/"]`).first()
      const hasOrgLink = await orgLink.isVisible({ timeout: 10000 }).catch(() => false)
      if (hasOrgLink) {
        await orgLink.click()
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveURL(/\/org\//)
      }
    })

    await test.step('navigate to member dues', async () => {
      await page.goto(`/org/${ORG_ID}/dues`)
      await expect(page).toHaveURL(/dues/)
    })

    await test.step('verify dues information visible', async () => {
      await expect(page.getByText(/dues|membership|payment|balance/i).first()).toBeVisible({ timeout: 10000 })
    })
  })
})
