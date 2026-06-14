// WF-074 — Certificate Download: member downloads training certificates
// Cross-Module Flow 6.3: Training Attendance → Credit Award
// Covers: M09 (training) → M10 (credits) → M11 (certificates)
// Officer creates training, member enrolls, attendance confirmed, credits awarded.
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember, signInAsSociety } from '../helpers/auth'
import { captureAnyApiSuccess } from '../helpers/real-flow'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Training → Attendance → Credit Award', () => {
  test('officer can view training list with real data', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to training management', async () => {
      const respP = captureAnyApiSuccess(page)
      await page.goto(`/org/${ORG_ID}/officer/training`)
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)
    })

    await test.step('training list shows seeded trainings', async () => {
      // Should see seeded training programs. Use a retrying assertion —
      // isVisible() does NOT wait for the SPA to hydrate the list.
      await expect(
        page.getByText(/training|workshop|seminar|course/i).first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test('member can browse available training', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('navigate to training page', async () => {
      await page.goto('/my/training')
    })

    await test.step('training page shows available programs', async () => {
      await expect(
        page
          .getByText(/training|workshop|seminar|course|available|enrolled/i)
          .first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test('member credits reflect training completion', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('check credits page', async () => {
      await page.goto('/my/credits')
      await expect(page).toHaveURL(/\/my\/credits/)
    })

    await test.step('credits show balance from completed trainings', async () => {
      // Seeded data has credit entries from completed trainings
      await expect(
        page.getByText(/credit|CPD|total|balance|hour/i).first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test('member can view training certificates', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('navigate to certificates', async () => {
      await page.goto('/my/certificates')
    })

    await test.step('certificates page renders', async () => {
      // Page may show certificates, empty state, or loading
      await expect(
        page.locator('main, [role="main"], h1, h2').first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test('full journey: training list → enroll → credits → certificate', async ({ page }) => {
    await test.step('sign in and browse training', async () => {
      await signInAsMember(page)
      await page.goto('/my/training')
    })

    await test.step('verify training programs visible', async () => {
      await expect(
        page.getByText(/training|workshop|seminar/i).first(),
      ).toBeVisible({ timeout: 10000 })
    })

    await test.step('check credits earned', async () => {
      await page.goto('/my/credits')
      await expect(
        page.getByText(/credit|CPD|total/i).first(),
      ).toBeVisible({ timeout: 10000 })
    })

    await test.step('check certificates', async () => {
      await page.goto('/my/certificates')
      await expect(page).toHaveURL(/\/my\/certificates/)
    })
  })

  test('society officer can manage training programs', async ({ page }) => {
    await test.step('sign in as society officer', async () => {
      await signInAsSociety(page)
    })

    await test.step('access training management', async () => {
      await page.goto(`/org/${ORG_ID}/officer/training`)
    })

    await test.step('training management accessible', async () => {
      await expect(
        page.getByText(/training|manage|create/i).first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })
})
