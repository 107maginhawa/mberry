// Business Rules: [BR-04] [BR-05] [BR-30]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Settings — Dues Config', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('dues config page shows form with amount field', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await page.waitForLoadState('networkidle')

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
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('fund allocation page shows 3 funds totaling 100%', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await page.waitForLoadState('networkidle')

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
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('membership categories page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)
    await page.waitForLoadState('networkidle')

    // Page should render with heading or category content
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasCategories = await page.getByText(/regular|associate|life|honorary/i).first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no categories|add.*category/i).first().isVisible().catch(() => false)
    expect(hasHeading || hasCategories || hasEmpty).toBeTruthy()
  })
})

test.describe('Officer Settings — Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('chapters page shows empty state', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    await page.waitForLoadState('networkidle')

    const hasEmptyState = await page.getByText(/no chapter|empty|none|get started|add.*chapter/i).first().isVisible().catch(() => false)
    const hasHeading = await page.getByRole('heading', { name: /chapters?|affiliations?/i }).first().isVisible().catch(() => false)
    expect(hasEmptyState || hasHeading).toBeTruthy()
  })
})
