// Business Rules: [BR-04] [BR-05] [BR-06] [BR-08] [BR-32]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Payments', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('heading "Dues & Payments" is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /dues.*payments?|payments?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows metric cards: Collection Rate, Total Collected, Outstanding', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/collection rate/i).first()
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/total collected/i).first()
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/outstanding/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows Pending metric', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/pending/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Record Payment button or link is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    const recordBtn = page.getByRole('link', { name: /record payment/i })
      .or(page.getByRole('button', { name: /record payment/i }))
      .first()
    await expect(recordBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to record payment page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    const recordBtn = page.getByRole('link', { name: /record payment/i })
      .or(page.getByRole('button', { name: /record payment/i }))
      .first()
    await recordBtn.click()

    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/payments/new')
  })

  test('[BR-32] payment history page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')
    const hasTable = await page.locator('table, [role="table"]').first().isVisible().catch(() => false)
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    expect(hasTable || hasHeading).toBeTruthy()
  })
})
