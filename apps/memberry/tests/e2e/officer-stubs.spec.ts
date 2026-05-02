import { test, expect } from '@playwright/test'
import { signUp, signIn } from './helpers/auth'

// M07-M10: Static stub officer pages — no API calls, just rendering verification
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'

let credentials: { email: string; password: string; name: string }

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  credentials = await signUp(page)
  await page.close()
})

test.describe('M07: Communications (/org/:orgId/officer/communications)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/communications`)

    await expect(page.getByRole('heading', { name: 'Communications' })).toBeVisible()
    await expect(page.getByText('No messages yet.')).toBeVisible()
  })

  test('shows New Message button', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/communications`)

    await expect(page.getByRole('link', { name: 'New Message' })).toBeVisible()
  })
})

test.describe('M08: Events (/org/:orgId/officer/events)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/events`)

    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible()
    await expect(page.getByText('No events yet.')).toBeVisible()
  })

  test('shows Create Event button', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/events`)

    await expect(page.getByRole('link', { name: 'Create Event' })).toBeVisible()
  })
})

test.describe('M09: Training (/org/:orgId/officer/training)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/training`)

    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible()
    await expect(page.getByText('No training sessions yet.')).toBeVisible()
  })

  test('shows Create Training button', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/training`)

    await expect(page.getByRole('link', { name: 'Create Training' })).toBeVisible()
  })
})

test.describe('M10: Credit Report (/org/:orgId/officer/reports/credits)', () => {
  test('renders heading and compliance cards', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/reports/credits`)

    await expect(page.getByRole('heading', { name: 'Credit Compliance Report' })).toBeVisible()
    await expect(page.getByText('Compliant', { exact: true })).toBeVisible()
    await expect(page.getByText('At Risk')).toBeVisible()
    await expect(page.getByText('Non-Compliant')).toBeVisible()
  })

  test('shows empty table state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/reports/credits`)

    await expect(page.getByText('No member credit data available.')).toBeVisible()
  })
})
