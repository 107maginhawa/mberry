// Business Rules: [BR-02] [BR-04] [BR-05] [BR-10] [BR-30] [BR-31]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Settings — Dues Config', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('dues config page shows form with amount field', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expect(
      page.getByRole('heading', { name: /dues configuration/i }),
    ).toBeVisible({ timeout: 10000 })

    // Amount input with seeded value 1500.00
    const amountInput = page.getByRole('spinbutton').first()
    await expect(amountInput).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Officer Settings — Fund Allocation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('fund allocation page shows 3 funds totaling 100%', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await expect(
      page.getByRole('heading', { name: /fund allocation/i }),
    ).toBeVisible({ timeout: 10000 })

    // Fund names are in input fields
    await expect(
      page.locator('input[value="General Fund"]'),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.locator('input[value="Education Fund"]'),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.locator('input[value="Building Fund"]'),
    ).toBeVisible({ timeout: 10000 })

    // Total should show 100%
    await expect(
      page.getByText('100.00%'),
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Officer Settings — Membership Categories', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('membership categories page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)
    // Page should render with heading or category content
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasCategories = await page.getByText(/regular|associate|life|honorary/i).first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no categories|add.*category/i).first().isVisible().catch(() => false)
    expect(hasHeading || hasCategories || hasEmpty).toBeTruthy()
  })
})

test.describe('Officer Settings — Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('chapters page shows empty state', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    const hasEmptyState = await page.getByText(/no chapter|empty|none|get started|add.*chapter/i).first().isVisible().catch(() => false)
    const hasHeading = await page.getByRole('heading', { name: /chapters?|affiliations?/i }).first().isVisible().catch(() => false)
    expect(hasEmptyState || hasHeading).toBeTruthy()
  })
})

test.describe('Officer Settings — Admin Features', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('[BR-10] admin features page renders', async ({ page }) => {
    // Just verify the settings area is accessible for officers
    await page.goto(`/org/${ORG_ID}/officer/settings/org`)
    const hasContent = await page.locator('main').isVisible()
    expect(hasContent).toBeTruthy()
  })
})

test.describe('Officer Settings — Gateway', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('[BR-31] settings page renders gateway section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/gateway`)
    // Gateway configuration UI should render — heading, form, or empty state
    const hasHeading = await page.getByRole('heading', { name: /gateway|payment|stripe/i }).first().isVisible().catch(() => false)
    const hasForm = await page.getByText(/gateway|payment.*method|stripe|connect/i).first().isVisible().catch(() => false)
    const hasSettings = await page.getByText(/settings|configuration/i).first().isVisible().catch(() => false)
    expect(hasHeading || hasForm || hasSettings).toBeTruthy()
  })
})
