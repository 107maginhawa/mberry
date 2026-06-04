import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const FAKE_ID = '00000000-0000-0000-0000-000000000000'

test.describe('Officer Detail Pages', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('roster member detail page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster/${FAKE_ID}`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('event detail page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/${FAKE_ID}`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('election detail page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections/${FAKE_ID}`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('communication detail page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/${FAKE_ID}`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('payment detail page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/${FAKE_ID}`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('event attendance page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/${FAKE_ID}/attendance`)
    const hasContent = await page.locator('h1, h2, [role="heading"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/not found|no data|does not exist/i).first().isVisible().catch(() => false)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })
})
