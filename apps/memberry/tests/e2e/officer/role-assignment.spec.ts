// WF-025 — Officer Role Assignment: assign positions to members
// BR-09: Officer role assignment
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-09: Role Assignment', () => {
test('officers page loads with officer list', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    // Should show officers or heading
    await expect(page.getByText(/officer|role|position/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('officers page shows existing officer assignments', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    // Should display officer names or roles
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')

    // Should show at least one role like President, Treasurer, etc
    await expect(page.getByText(/president|treasurer|secretary|officer/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('officers page renders without errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('Something went wrong')
    expect(pageText).not.toContain('Error')
  })
})
