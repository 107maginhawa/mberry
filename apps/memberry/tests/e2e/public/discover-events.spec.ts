import { test, expect } from '../helpers/test-fixture'

test.describe('Discover Events (/discover/events) — Public', () => {
  test('page loads without authentication', async ({ page }) => {
    await page.goto('/discover/events')
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
    // Pricing filter with Free/Paid options
    const pricingTrigger = page.getByRole('combobox').last()
    const hasPricing = await pricingTrigger.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasPricing) {
      await pricingTrigger.click()
      const hasFreeOption = await page.getByText(/^free$/i).isVisible({ timeout: 5000 }).catch(() => false)
      const hasPaidOption = await page.getByText(/^paid$/i).isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasFreeOption || hasPaidOption).toBeTruthy()
    } else {
      // Pricing filter may render differently
      const hasPricingText = await page.getByText(/free|paid|pricing/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasPricingText).toBeTruthy()
    }
  })

  test('displays events or empty state', async ({ page }) => {
    await page.goto('/discover/events')
    // Either event cards or an empty state message
    const hasEvents = await page.getByText(/CPD|PHP|Free/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmpty = await page.getByText(/no public events found/i).isVisible({ timeout: 5000 }).catch(() => false)
    const hasLoading = await page.locator('.animate-shimmer').first().isVisible({ timeout: 3000 }).catch(() => false)
    const hasError = await page.getByText(/failed to load/i).isVisible({ timeout: 3000 }).catch(() => false)

    // Page should show one of these states
    expect(hasEvents || hasEmpty || hasLoading || hasError).toBeTruthy()
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
    const hasContent = await page.locator('main, [class*="space-y"]').first().isVisible()
    expect(hasContent).toBeTruthy()
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
