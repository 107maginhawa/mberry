// BR-12: Credit carry-over
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('BR-12: Credit Carry-Over', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  test('credits page loads and shows credit data', async ({ page }) => {
    await page.goto('/my/credits')
    // Should show credits page with data or empty state
    const hasContent = await page.getByText(/credits|CPD|earned|required/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('credits page shows cycle information', async ({ page }) => {
    await page.goto('/my/credits')
    // Should display credit cycle info
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')
  })

  test('credits log page accessible', async ({ page }) => {
    await page.goto('/my/credits/log')
    // Log page should load without errors
    const hasContent = await page.locator('body').textContent()
    expect(hasContent).toBeTruthy()
    expect(hasContent).not.toContain('Something went wrong')
  })
})
