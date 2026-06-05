// Phase 16-02: Mobile viewport tests (375×812)
// Validates critical flows render correctly at mobile dimensions
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember, signInAsOfficer, signInAsTreasurer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Mobile: Member Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  test('dashboard renders without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible()

    // Check no horizontal scroll
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('member organizations page is usable at mobile width', async ({ page }) => {
    await page.goto('/my/organizations')
    // Verify content loads
    await expect(page.locator('body')).toBeVisible()

    // Check no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('member events page renders at mobile width', async ({ page }) => {
    await page.goto('/my/events')
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })
})

test.describe('Mobile: Officer Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page)
  })

  test('officer dashboard loads without horizontal overflow', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('officer roster page renders at mobile width', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('officer events page renders at mobile width', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })
})

test.describe('Mobile: Dues & Payments', () => {
  test('dues page renders without overflow for treasurer', async ({ page }) => {
    await signInAsTreasurer(page)
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('payment form page is usable at mobile width', async ({ page }) => {
    await signInAsTreasurer(page)
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page.locator('body')).toBeVisible()

    // Check no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)

    // Verify form elements are within viewport width
    const viewportWidth = page.viewportSize()?.width ?? 375
    const formOverflows = await page.evaluate((vw) => {
      const inputs = document.querySelectorAll('input, select, textarea, button')
      for (const el of inputs) {
        const rect = el.getBoundingClientRect()
        if (rect.right > vw + 2) return true // 2px tolerance
      }
      return false
    }, viewportWidth)
    expect(formOverflows).toBe(false)
  })
})

test.describe('Mobile: Member Org Page', () => {
  test('org home page renders at mobile width', async ({ page }) => {
    await signInAsMember(page)
    await page.goto(`/org/pda-metro-manila/home`)
    await expect(page.locator('body')).toBeVisible()

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)
  })
})
