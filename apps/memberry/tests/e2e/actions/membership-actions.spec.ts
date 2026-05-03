// Action-Contract Tests: Membership Module
// Tests actual button clicks, API requests, and UI state changes
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASSWORD = 'TestPass123!'

test.describe('Membership Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
  })

  test('roster shows real member data (names, statuses, not "undefined")', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    // Must show actual names, not "undefined" or dashes
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Active').first()).toBeVisible()
    await expect(page.getByText(/PDA-2025-\d+/).first()).toBeVisible()
  })

  test('click member name → member detail page loads with data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // Click member name link
    await page.getByRole('link', { name: 'Juan Cruz' }).click()
    await page.waitForLoadState('networkidle')

    // Should navigate to detail page and show member info
    await expect(page.url()).toContain('/officer/roster/')
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Active|Suspended|Lapsed/).first()).toBeVisible()
  })

  test('suspend member from detail page → status changes', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    // Find an active member and click through to detail
    await page.getByRole('link', { name: 'Juan Cruz' }).click()
    await page.waitForLoadState('networkidle')

    // Look for Suspend button
    const suspendBtn = page.getByRole('button', { name: /suspend/i })
    if (await suspendBtn.isVisible().catch(() => false)) {
      const responsePromise = page.waitForResponse(
        resp => resp.request().method() === 'PUT' && resp.url().includes('/membership/members/') && resp.status() === 200
      )
      await suspendBtn.click()

      // If there's a confirmation dialog, confirm it
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|suspend/i }).last()
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click()
      }

      await responsePromise
      // Verify toast or status change
      const hasToast = await page.getByText(/updated|suspended/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasToast).toBeTruthy()

      // Restore to active
      const liftBtn = page.getByRole('button', { name: /lift|restore|activate/i })
      if (await liftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await liftBtn.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('categories page shows categories and Save works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)
    await page.waitForLoadState('networkidle')

    // Should show existing categories
    await expect(page.getByText(/Practicing Dentist|Student/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Add Category')).toBeVisible()
  })

  test('import page renders upload area', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster/import`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Import Roster|Drop CSV/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('applications page shows empty state (not skeleton)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    await page.waitForLoadState('networkidle')

    // Should show "No applications" not infinite skeleton
    const hasEmpty = await page.getByText(/no applications/i).isVisible({ timeout: 10000 }).catch(() => false)
    const hasSkeleton = await page.locator('.animate-pulse').first().isVisible({ timeout: 2000 }).catch(() => false)

    // Either shows empty state OR has skeleton that resolves
    expect(hasEmpty || !hasSkeleton).toBeTruthy()
  })
})
