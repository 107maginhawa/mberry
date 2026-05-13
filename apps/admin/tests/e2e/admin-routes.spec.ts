import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Admin route coverage (Phase 4 gap fill)', () => {
  test('feature-flags page loads', async ({ page }) => {
    await signInAndNavigate(page, '/feature-flags')
    await page.waitForLoadState('networkidle')

    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible().catch(() => false)
    expect(hasHeading || hasContent).toBeTruthy()
  })

  test('operators page loads', async ({ page }) => {
    await signInAndNavigate(page, '/operators')
    await page.waitForLoadState('networkidle')

    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible().catch(() => false)
    expect(hasHeading || hasContent).toBeTruthy()
  })

  test('impersonate page loads', async ({ page }) => {
    await signInAndNavigate(page, '/impersonate')
    await page.waitForLoadState('networkidle')

    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible().catch(() => false)
    expect(hasHeading || hasContent).toBeTruthy()
  })
})
