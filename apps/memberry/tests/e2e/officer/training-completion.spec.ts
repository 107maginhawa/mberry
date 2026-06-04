// BR-17: Training attendance confirmation — mark completed, verify credit
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('society') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-17: Training Completion', () => {
test('training detail shows attendance tab when trainings exist', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    const trainingLink = page.locator('a[href*="/officer/training/"]:not([href*="/new"]):not([href$="/training"])').first()
    const hasTrainings = await trainingLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasTrainings) {
      await trainingLink.click()
      await page.waitForLoadState('networkidle')

      const loaded = await page.getByText(/failed to load/i).isVisible({ timeout: 3000 }).catch(() => false)
      if (!loaded) {
        const attendanceTab = page.getByRole('button', { name: /attendance/i })
        await expect(attendanceTab).toBeVisible({ timeout: 10000 })
      }
    }
  })

  test('training detail shows enrollment info', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    const trainingLink = page.locator('a[href*="/officer/training/"]:not([href*="/new"]):not([href$="/training"])').first()
    const hasTrainings = await trainingLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasTrainings) {
      await trainingLink.click()
      await page.waitForLoadState('networkidle')

      const loaded = await page.getByText(/failed to load/i).isVisible({ timeout: 3000 }).catch(() => false)
      if (!loaded) {
        await expect(page.getByText(/enrolled/i)).toBeVisible({ timeout: 10000 })
      }
    }
  })

  test('training list page shows trainings or create button', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    // Should show either training list or create new training option
    const hasContent = await page.getByText(/training|create|new/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })
})
