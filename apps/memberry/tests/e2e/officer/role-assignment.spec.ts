// BR-09: Officer role assignment
import { test, expect } from '@playwright/test'
import { signInAsOfficer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-09: Role Assignment', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page)
  })

  test('officers page loads with officer list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    await page.waitForLoadState('networkidle')

    // Should show officers or heading
    const hasContent = await page.getByText(/officer|role|position/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('officers page shows existing officer assignments', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    await page.waitForLoadState('networkidle')

    // Should display officer names or roles
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')

    // Should show at least one role like President, Treasurer, etc
    const hasRole = await page.getByText(/president|treasurer|secretary|officer/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasRole).toBeTruthy()
  })

  test('officers page renders without errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    await page.waitForLoadState('networkidle')

    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('Something went wrong')
    expect(pageText).not.toContain('Error')
  })
})
