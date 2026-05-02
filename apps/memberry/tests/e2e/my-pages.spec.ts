import { test, expect } from '@playwright/test'
import { signUp, signIn } from './helpers/auth'

// Authenticated "My" pages + officer event detail — mostly static stubs
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001'

let credentials: { email: string; password: string; name: string }

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  credentials = await signUp(page)
  await page.close()
})

test.describe('Dashboard (/dashboard)', () => {
  test('renders heading', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/dashboard')

    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
  })
})

test.describe('My Notifications (/my/notifications)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/notifications')

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
    await expect(page.getByText('No notifications yet.')).toBeVisible()
  })
})

test.describe('My ID Card (/my/id-card)', () => {
  test('renders card layout with placeholders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/id-card')

    await expect(page.getByRole('heading', { name: 'Digital ID Card' })).toBeVisible()
    await expect(page.getByText('Member Name')).toBeVisible()
    await expect(page.getByText('QR Code')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible()
  })
})

test.describe('My Events (/my/events)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/events')

    await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
    await expect(page.getByText('No upcoming events.')).toBeVisible()
  })
})

test.describe('My Training (/my/training)', () => {
  test('renders heading and empty state', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/training')

    await expect(page.getByRole('heading', { name: 'My Training' })).toBeVisible()
    await expect(page.getByText('No training sessions yet.')).toBeVisible()
  })
})

test.describe('My Payments (/my/payments)', () => {
  test('renders heading', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/payments')

    await expect(page.getByRole('heading', { name: 'My Payments' })).toBeVisible()
  })
})

test.describe('My Credits (/my/credits)', () => {
  test('renders summary cards and empty table', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/credits')

    await expect(page.getByRole('heading', { name: 'CPD Credits' })).toBeVisible()
    await expect(page.getByText('Earned', { exact: true })).toBeVisible()
    await expect(page.getByText('Required', { exact: true })).toBeVisible()
    await expect(page.getByText('Carryover', { exact: true })).toBeVisible()
    await expect(page.getByText('No credits earned yet.', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: /View full log/ })).toBeVisible()
  })
})

test.describe('Credit Log (/my/credits/log)', () => {
  test('renders heading and empty table', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/credits/log')

    await expect(page.getByRole('heading', { name: 'Credit Log' })).toBeVisible()
    await expect(page.getByText('No credit entries yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to Credits/ })).toBeVisible()
  })
})

test.describe('Event Attendance (/org/:orgId/officer/events/:eventId)', () => {
  test('renders heading and metric cards', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/events/evt-123`)

    await expect(page.getByRole('heading', { name: 'Event Attendance' })).toBeVisible()
    await expect(page.getByText('Registered')).toBeVisible()
    await expect(page.getByText('Checked In')).toBeVisible()
    await expect(page.getByText('No Show')).toBeVisible()
    await expect(page.getByText('No registrations yet.')).toBeVisible()
  })

  test('has back link to events list', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto(`/org/${TEST_ORG_ID}/officer/events/evt-123`)

    await expect(page.getByRole('link', { name: /Back to Events/ })).toBeVisible()
  })
})
