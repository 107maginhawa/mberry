import { test, expect } from '@playwright/test'

const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASS = 'TestPass123!'
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('F2: Dues & Payments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.locator('input[name="email"]').fill(OFFICER_EMAIL)
    await page.locator('input[name="password"]').fill(OFFICER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(dashboard|org|my)/, { timeout: 15000 })
  })

  test('officer can configure dues settings', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expect(page.getByRole('heading', { name: /dues configuration/i })).toBeVisible()

    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('1500')

    await expect(page.getByText('Annual')).toBeVisible()

    const graceInput = page.locator('input[min="0"][max="365"]')
    await graceInput.fill('30')

    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/updated|saved/i)).toBeVisible()
  })

  test('officer can configure fund allocation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await expect(page.getByRole('heading', { name: /fund allocation/i })).toBeVisible()

    await expect(page.getByDisplayValue('General Fund')).toBeVisible()
    await expect(page.getByDisplayValue('100')).toBeVisible()

    await expect(page.getByText('100.00%')).toBeVisible()
  })

  test('officer can access financial dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByRole('heading', { name: /dues & payments/i })).toBeVisible()

    await expect(page.getByText('Collection Rate')).toBeVisible()
    await expect(page.getByText('Total Collected')).toBeVisible()
    await expect(page.getByText('Outstanding')).toBeVisible()
    await expect(page.getByText('Pending Payments')).toBeVisible()

    await expect(page.getByRole('link', { name: /record payment/i })).toBeVisible()
  })

  test('officer can navigate to record payment form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.getByRole('link', { name: /record payment/i }).click()
    await page.waitForURL(/\/payments\/new/)
    await expect(page.getByRole('heading', { name: /record payment/i })).toBeVisible()

    await expect(page.getByText('Payment Method')).toBeVisible()
    await expect(page.getByText(/fund allocation/i)).toBeVisible()
  })

  test('member can view payment history', async ({ page }) => {
    await page.goto('/my/payments')
    await expect(page.getByRole('heading', { name: /my payments/i })).toBeVisible()

    await expect(page.getByText('All Statuses')).toBeVisible()
    await expect(page.getByText('All Methods')).toBeVisible()
  })
})
