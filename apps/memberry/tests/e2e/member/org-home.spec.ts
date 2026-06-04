import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Org Home (/org/$orgId/home)', () => {
test('shows Organization Home heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    await expect(
      page.getByRole('heading', { name: 'Organization Home' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows Recent Announcements section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    await expect(
      page.getByText('Recent Announcements').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows Upcoming Events section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    await expect(
      page.getByText('Upcoming Events').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('has View all events link', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    await expect(
      page.getByRole('link', { name: /view all/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
