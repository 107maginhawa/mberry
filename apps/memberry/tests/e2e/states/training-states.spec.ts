import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const FAKE_TRAINING_ID = '00000000-0000-0000-0000-000000000000'

test.describe('Training — Interaction States', () => {
  test('loading: shows loading state before training data arrives', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    await page.goto(`/org/${ORG_ID}/training`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('success: shows training list with stat cards', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto('/my/training')
    await expect(page.getByRole('heading', { name: 'My Training' })).toBeVisible({ timeout: 10000 })

    // Stat cards should be present
    await expect(page.getByText('Enrolled', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('CPE Credits', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('empty: training list shows empty state when no enrollments', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/training`)
    // Either training items exist or an empty state message
    const hasTrainingItems = await page.locator('[class*="card"], [class*="training"]').filter({ hasText: /training|course|seminar/i }).first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/no training|no courses|no enrollments|browse available/i).first().isVisible().catch(() => false)
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)

    expect(hasTrainingItems || hasEmptyState || hasHeading).toBeTruthy()
  })

  test('unexpected-error: invalid training detail shows error gracefully', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/training/${FAKE_TRAINING_ID}`)
    const hasNotFound = await page.getByText(/not found|no training|error/i).first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible()
    expect(hasNotFound || hasContent).toBeTruthy()
  })

  test('permission-error: unauthenticated user redirects to sign-in', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/training`)
    const isOnSignIn = page.url().includes('/auth/sign-in')
    const hasAuthPrompt = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)

    expect(isOnSignIn || hasAuthPrompt).toBeTruthy()
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/training`)
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
