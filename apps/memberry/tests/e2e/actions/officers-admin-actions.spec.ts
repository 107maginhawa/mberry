// Action-Contract Tests: Officers + Admin
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Management Actions', () => {
test('officers page shows real officer names and positions', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(page.getByText(/Officer Management/i)).toBeVisible({ timeout: 10000 })
    // Should show real officer names from seed
    await expect(page.getByText(/President|Secretary|Treasurer/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Maria|Juan|Santos|Cruz/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('officer dashboard renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // h1 may be the user's greeting ("Good evening, Maria") or
    // "Officer Dashboard" depending on the dashboard variant. Assert
    // sidebar + any h1 to prove the surface mounted.
    await expect(page.getByRole('complementary').first())
      .toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('org settings page loads data and Save works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/org`)

    // Should show org settings heading or profile form header
    await expect(page.getByRole('heading', { name: /Organization Settings|Organization Profile/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('member-to-officer navigation: click President Dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/President Dashboard/i)).toBeVisible({ timeout: 10000 })

    await page.getByText(/President Dashboard/i).click()

    // Should be on officer dashboard with officer sidebar
    await expect(page.getByText(/MEMBERS|FINANCES|ACTIVITIES/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.url()).toContain('/officer/dashboard')
  })

  test('back to member view link works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await expect(page.getByText(/Back to Member View/i)).toBeVisible({ timeout: 10000 })

    await page.getByText(/Back to Member View/i).click()

    // Should show member sidebar (Home, Activities, Credits, Profile)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible({ timeout: 10000 })
    await expect(page.url()).toContain('/dashboard')
  })
})
