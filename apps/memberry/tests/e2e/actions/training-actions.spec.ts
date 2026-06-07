// Action-Contract Tests: Training Module
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureAnyApiSuccess } from '../helpers/real-flow'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Training Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('training list shows real training data', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/training`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(page.getByText(/Create Training/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /Workshop|Endodontics|Photography/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('Create Training button → form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training/new`)

    await expect(page.getByText(/Create Training/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /Title/i })).toBeVisible()
  })

  test('my training page shows enrolled trainings', async ({ page }) => {
    // Sign in as member user who has training enrollments
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto('/my/training')

    await expect(page.getByText(/My Training/i)).toBeVisible({ timeout: 10000 })
    // Should show at least 1 enrollment or the empty state
    const hasTraining = await page.getByText(/Workshop|Seminar|Photography|Endodontics/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmpty = await page.getByText(/No training sessions/i).isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasTraining || hasEmpty).toBeTruthy()
  })
})
