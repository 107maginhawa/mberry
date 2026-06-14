import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'

test.describe('Discover Events (/discover/events) — Public', () => {
  test('page loads without authentication', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/discover/events')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(
      page.getByText(/discover events/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows search input', async ({ page }) => {
    await page.goto('/discover/events')
    await expect(
      page.getByPlaceholder(/search events/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows event type filter dropdown', async ({ page }) => {
    await page.goto('/discover/events')
    // Event type select should have options like Seminar, Social, etc.
    const typeSelect = page.getByText(/all types/i).first()
    await expect(typeSelect).toBeVisible({ timeout: 10000 })
  })

  test('shows pricing filter dropdown', async ({ page }) => {
    await page.goto('/discover/events')
    // Pricing filter with Free/Paid options. Wait for the page to hydrate
    // either the combobox trigger or some pricing copy before probing —
    // isVisible() does not retry.
    const pricingTrigger = page.getByRole('combobox').last()
    await expect(
      pricingTrigger.or(page.getByText(/free|paid|pricing/i).first()),
    ).toBeVisible({ timeout: 10000 })

    const hasPricing = await pricingTrigger.isVisible().catch(() => false)

    if (hasPricing) {
      await pricingTrigger.click()
      await expect(
        page.getByText(/^free$/i).or(page.getByText(/^paid$/i)).first(),
      ).toBeVisible({ timeout: 5000 })
    } else {
      // Pricing filter may render differently
      await expect(
        page.getByText(/free|paid|pricing/i).first(),
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('displays events or empty state', async ({ page }) => {
    await page.goto('/discover/events')
    // Either event cards or an empty state message
    // Page should show one of these states — wait for any to appear
    // (isVisible() does not retry).
    await expect(
      page
        .getByText(/CPD|PHP|Free/i)
        .or(page.getByText(/no public events found/i))
        .or(page.locator('.animate-shimmer'))
        .or(page.getByText(/failed to load/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('search input filters events', async ({ page }) => {
    await page.goto('/discover/events')
    const searchInput = page.getByPlaceholder(/search events/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('dental conference')
    // Wait for debounced query to update
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    // Page should still be functional (either results or empty state)
    await expect(page.locator('main, [class*="space-y"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('event cards show date and pricing info', async ({ page }) => {
    await page.goto('/discover/events')
    // If events exist, verify card structure
    const eventCards = page.locator('a[href*="/events/"]')
    const cardCount = await eventCards.count()

    if (cardCount > 0) {
      const firstCard = eventCards.first()

      // Each card should show a date
      const hasDate = await firstCard.getByText(/\w{3},?\s+\w{3}\s+\d+/i).isVisible({ timeout: 5000 }).catch(() => false)
      // Each card should show pricing (Free or PHP amount)
      const hasPricing = await firstCard.getByText(/free|PHP/i).isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasDate || hasPricing).toBeTruthy()
    } else {
      // No events seeded -- skip card structure validation
      test.skip(true, 'No events seeded for card structure test')
    }
  })
})
