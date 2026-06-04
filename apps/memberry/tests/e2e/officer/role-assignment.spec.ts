// BR-09: Officer role assignment
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-09: Role Assignment', () => {
test('officers page loads with officer list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    // Should show officers or heading
    const hasContent = await page.getByText(/officer|role|position/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('officers page shows existing officer assignments', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    // Should display officer names or roles
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')

    // Should show at least one role like President, Treasurer, etc
    const hasRole = await page.getByText(/president|treasurer|secretary|officer/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasRole).toBeTruthy()
  })

  test('officers page renders without errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/officers`)
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('Something went wrong')
    expect(pageText).not.toContain('Error')
  })
})
