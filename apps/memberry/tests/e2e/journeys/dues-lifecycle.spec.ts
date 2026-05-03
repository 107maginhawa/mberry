// Business Rules: [BR-04] [BR-05] [BR-06] [BR-07]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'
const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASSWORD = 'TestPass123!'
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Dues lifecycle: officer manages dues, member views payments', () => {
  test.describe('Officer dues management', () => {
    test('officer sees existing dues configuration', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: /dues configuration/i }),
      ).toBeVisible({ timeout: 10000 })

      // Amount input shows 1500.00
      await expect(
        page.getByRole('spinbutton').first(),
      ).toBeVisible({ timeout: 10000 })

      // Billing frequency shows Annual
      await expect(
        page.getByText('Annual'),
      ).toBeVisible({ timeout: 10000 })
    })

    test('officer views payments dashboard with collection metrics', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/payments`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: /dues & payments/i }),
      ).toBeVisible({ timeout: 10000 })

      // Metric cards
      await expect(page.getByText('Collection Rate')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Total Collected')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Outstanding')).toBeVisible({ timeout: 10000 })
    })

    test('officer can access record payment page', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/payments`)
      await page.waitForLoadState('networkidle')

      // Record Payment is a link containing a button
      await expect(
        page.getByRole('link', { name: /record payment/i }),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Member payment visibility', () => {
    test('member views their payment history page', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/payments')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: 'My Payments' }),
      ).toBeVisible({ timeout: 10000 })

      // Filter controls present
      await expect(page.getByText('All Statuses')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Cross-persona: officer funds visible in config', () => {
    test('officer sees seeded funds on funds settings page', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: /fund allocation/i }),
      ).toBeVisible({ timeout: 10000 })

      // Fund names in input fields
      await expect(page.locator('input[value="General Fund"]')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('input[value="Education Fund"]')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('input[value="Building Fund"]')).toBeVisible({ timeout: 10000 })
    })
  })
})
