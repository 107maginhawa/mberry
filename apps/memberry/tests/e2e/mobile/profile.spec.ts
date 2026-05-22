// Mobile viewport test for profile and settings pages
// Viewport: 375×812 (iPhone X)
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('Mobile: Profile & Settings', () => {
  test('profile page renders correctly on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')

    // Profile should render — check for any meaningful content (not blank page)
    // Profile may show user name, form fields, avatar, or settings
    const hasContent = await page.locator('main, [role="main"], form, input, h1, h2').first().isVisible({ timeout: 10000 }).catch(() => false)
      || await page.getByText(/profile|name|email|save|edit|member|Miguel/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('settings page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')

    const hasSettings = await page.getByText(/setting|preference|notification/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasSettings).toBeTruthy()
  })

  test('organizations page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/organizations')
    await page.waitForLoadState('networkidle')

    const hasOrgs = await page.getByText(/organization|membership|PDA/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasOrgs).toBeTruthy()
  })

  test('mobile bottom navigation is visible', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Mobile should show bottom nav bar
    const bottomNav = page.locator('nav').last()
    const hasNav = await bottomNav.isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasNav).toBeTruthy()
  })

  test('ID card page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/id-card')
    await page.waitForLoadState('networkidle')

    const hasCard = await page.getByText(/id.*card|member.*card|digital/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasCard).toBeTruthy()
  })
})
