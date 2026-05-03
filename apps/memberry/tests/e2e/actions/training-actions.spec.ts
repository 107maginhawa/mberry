// Action-Contract Tests: Training Module
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Training Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('training list shows real training data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Create Training/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /Workshop|Endodontics|Photography/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('Create Training button → form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training/new`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Create Training/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /Title/i })).toBeVisible()
  })

  test('my training page shows enrolled trainings', async ({ page }) => {
    await page.goto('/my/training')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/My Training/i)).toBeVisible({ timeout: 10000 })
    // Should show at least 1 enrollment
    const hasTraining = await page.getByText(/Workshop|Seminar|Photography/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTraining).toBeTruthy()
  })
})
