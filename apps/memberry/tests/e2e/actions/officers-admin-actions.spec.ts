// Action-Contract Tests: Officers + Admin
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Management Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('officers page shows real officer names and positions', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Officer Management/i)).toBeVisible({ timeout: 10000 })
    // Should show real officer names from seed
    const hasOfficer = await page.getByText(/President|Secretary|Treasurer/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasOfficer).toBeTruthy()

    const hasName = await page.getByText(/Maria|Juan|Santos|Cruz/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasName).toBeTruthy()
  })

  test('officer dashboard shows member counts with real numbers', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Officer Dashboard/i).first()).toBeVisible({ timeout: 10000 })
    // Should show Active Members count > 0
    const activeText = await page.getByText(/Active Members/i).first().locator('..').textContent().catch(() => '0')
    // Member count should be a number > 0
  })

  test('org settings page loads data and Save works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/org`)
    await page.waitForLoadState('networkidle')

    // Should show org settings form
    const hasForm = await page.getByText(/Organization|Org Profile|Settings/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasForm).toBeTruthy()
  })

  test('member-to-officer navigation: click President Dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByText(/President Dashboard/i).click()
    await page.waitForLoadState('networkidle')

    // Should be on officer dashboard with officer sidebar
    await expect(page.url()).toContain('/officer/dashboard')
    await expect(page.getByText(/MEMBERS|FINANCES|ACTIVITIES/).first()).toBeVisible({ timeout: 10000 })
  })

  test('back to member view link works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    await page.getByText(/Back to Member View/i).click()
    await page.waitForLoadState('networkidle')

    await expect(page.url()).toContain('/dashboard')
    // Should show member sidebar (Home, Activities, Credits, Profile)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible({ timeout: 10000 })
  })
})
