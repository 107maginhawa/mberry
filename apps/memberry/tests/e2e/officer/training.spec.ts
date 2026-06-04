// Business Rules: [BR-15]
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Training', () => {
test('training list shows seeded training Advanced Endodontics', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    await expect(
      page.getByText(/advanced endodontics/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('training list shows seeded training Infection Control', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    await expect(
      page.getByText(/infection control/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Create Training button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    const createBtn = page.getByRole('link', { name: /create training|new training|add training/i })
      .or(page.getByRole('button', { name: /create training|new training|add training/i }))
      .first()
    await expect(createBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to training detail', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    // Click on first training
    const trainingLink = page.getByText(/advanced endodontics/i).first()
    await expect(trainingLink).toBeVisible({ timeout: 10000 })
    await trainingLink.click()

    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/officer/training/')
  })
})
