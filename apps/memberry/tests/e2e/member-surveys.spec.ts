// WF-101 — Survey Response
import { test, expect } from './helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from './helpers/test-config'
import { authStateFile } from './helpers/auth-state'


test.use({ storageState: authStateFile('member') })
test.describe('Feedback: Member Surveys', () => {
test('my surveys page loads without error', async ({ page }) => {
    await page.goto('/my/surveys')
    // Should NOT show error state
    await expect(page.getByText('Failed to load surveys')).not.toBeVisible()

    // Page header renders
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible()
  })

  test('page subtitle renders (no crash)', async ({ page }) => {
    await page.goto('/my/surveys')
    // Subtitle always renders regardless of data state
    await expect(
      page.getByText('Share your feedback and see past responses'),
    ).toBeVisible()
  })
})
