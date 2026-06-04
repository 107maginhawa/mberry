import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from './helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Feedback: Officer Reviews', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('reviews page loads without error', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reviews`)
    // Should NOT show error state
    await expect(page.getByText('Failed to load reviews')).not.toBeVisible()

    // Page header renders
    await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible()
  })

  test('page subtitle renders (no crash)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reviews`)
    // Subtitle always renders regardless of data state
    await expect(
      page.getByText('Member feedback and NPS scores'),
    ).toBeVisible()
  })

  test('no API 5xx errors on load', async ({ page }) => {
    const apiErrors: string[] = []
    page.on('response', (res) => {
      if (res.url().includes('/api/reviews') && res.status() >= 500) {
        apiErrors.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto(`/org/${ORG_ID}/officer/reviews`)
    expect(apiErrors).toEqual([])
  })
})
