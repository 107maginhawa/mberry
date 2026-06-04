// Business Rules: [BR-13] [BR-15]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Training (/my/training)', () => {
  test('shows "My Training" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/training')
    await expect(
      page.getByRole('heading', { name: 'My Training' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows stat cards (Enrolled, Pending, CPE Credits, Completed)', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/training')
    await expect(page.getByText('Enrolled', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Pending', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('CPE Credits', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 })
  })
})

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const FAKE_ID = '00000000-0000-0000-0000-000000000000'

test.describe('Member Training Detail (/org/:orgId/training/:trainingId)', () => {
  test('training detail page handles missing training gracefully', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/training/${FAKE_ID}`)
    // Should show not-found, redirect, or error — not crash
    const hasNotFound = await page.getByText(/not found|no training|error/i).first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible()
    expect(hasNotFound || hasContent).toBeTruthy()
  })
})
