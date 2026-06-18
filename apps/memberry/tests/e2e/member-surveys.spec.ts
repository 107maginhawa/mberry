// WF-101 — Survey Response
import { test, expect } from './helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from './helpers/test-config'
import { captureAnyApiSuccess } from './helpers/real-flow'


test.use({ authRole: 'member' })
test.describe('Feedback: Member Surveys', () => {
test('my surveys page loads without error', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/surveys')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
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
