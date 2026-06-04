import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD
const OFFICER_EMAIL = SEED_OFFICER_EMAIL
const OFFICER_PASSWORD = TEST_PASSWORD
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member navigation journey', () => {
  test('member signs in and lands on dashboard', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)

    await page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('member navigates through sidebar: Profile → Credits → Home', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    // Sidebar has: Home, Activities, Credits, Profile
    await page.getByRole('link', { name: /profile/i }).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/my\/profile/)

    await page.getByRole('link', { name: /credits/i }).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/my\/credits/)

    await page.getByRole('link', { name: /home/i }).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('Officer navigation journey', () => {
  test('officer signs in and navigates to org officer dashboard', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.waitForLoadState('networkidle')

    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_ID}/officer/dashboard`))
  })

  test('officer can access officer pages via direct navigation', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)

    // Roster
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(page.getByRole('heading', { name: /member roster/i })).toBeVisible({ timeout: 10000 })

    // Payments
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByRole('heading', { name: /dues & payments/i })).toBeVisible({ timeout: 10000 })

    // Events
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Public and auth guard navigation', () => {
  test('public org profile page accessible without auth', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/org/pda-metro-manila')
    await expect(page.getByText(/pda metro manila/i)).toBeVisible({ timeout: 10000 })
    expect(page.url()).not.toContain('/auth/')
  })

  test('unauthenticated user redirected from /dashboard to sign-in', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('/auth/sign-in')
  })
})
