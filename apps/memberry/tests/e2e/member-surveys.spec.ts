import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from './helpers/test-config'

test.describe('Feedback: Member Surveys', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
  })

  test('my surveys page loads without error', async ({ page }) => {
    await page.goto('/my/surveys')
    await page.waitForLoadState('networkidle')

    // Should NOT show error state
    await expect(page.getByText('Failed to load surveys')).not.toBeVisible()

    // Page header renders
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible()
  })

  test('page subtitle renders (no crash)', async ({ page }) => {
    await page.goto('/my/surveys')
    await page.waitForLoadState('networkidle')

    // Subtitle always renders regardless of data state
    await expect(
      page.getByText('Share your feedback and see past responses'),
    ).toBeVisible()
  })
})
