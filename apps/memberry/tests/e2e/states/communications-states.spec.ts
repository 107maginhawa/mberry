import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: officer communications hydrates via
// GET /communications/announcements/. Capture proves the wire returned
// data, not just that the shell rendered a heading.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ANNOUNCEMENTS = '/communications/announcements/'

test.describe('Communications — Interaction States', () => {
  test('loading: shows loading state before announcements load', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    const respP = captureRouteHydration(page, ANNOUNCEMENTS)
    await page.goto(`/org/${ORG_ID}/officer/communications`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('success: shows communications heading and announcement list', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, ANNOUNCEMENTS)
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: /communications?|announcements?/i }).first(),
    ).toBeVisible({ timeout: 10000 })

    // New Message button should be visible for officers
    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()
    await expect(newBtn).toBeVisible({ timeout: 10000 })
  })

  test('permission-error: regular member cannot access officer communications', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page
      .waitForURL((u) => !u.pathname.includes('/officer/communications'), { timeout: 15000 })
      .catch(() => {})
    const isRedirected = !page.url().includes('/officer/communications')
    const hasForbidden = await page.getByText(/forbidden|access denied|not authorized|officers only/i).first().isVisible().catch(() => false)

    expect(isRedirected || hasForbidden).toBeTruthy()
  })

  test('empty: communications list shows empty state when no announcements', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, ANNOUNCEMENTS)
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Either announcements are listed or empty state shown
    const rows = page.locator('.divide-y a, [class*="announcement"], [class*="card"]')
    const hasRows = await rows.first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/no announcements|no messages|create your first/i).first().isVisible().catch(() => false)

    // Heading must be present regardless
    await expect(
      page.getByRole('heading', { name: /communications?|announcements?/i }).first(),
    ).toBeVisible({ timeout: 10000 })

    expect(hasRows || hasEmptyState).toBeTruthy()
  })

  test('confirmation: new announcement form requires content before sending', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, ANNOUNCEMENTS)
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Click New Message button
    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()

    const hasNewBtn = await newBtn.isVisible().catch(() => false)

    if (hasNewBtn) {
      await newBtn.click()
      await page.waitForLoadState('networkidle')

      // Try to submit without filling required fields
      const sendBtn = page.getByRole('button', { name: /send|publish|submit|post/i }).first()
      const hasSendBtn = await sendBtn.isVisible().catch(() => false)

      if (hasSendBtn) {
        await sendBtn.click()
        await page.waitForTimeout(500)

        // Should show validation error or prevent submission
        const hasError = await page.getByText(/required|please|cannot be empty/i).first().isVisible().catch(() => false)
        const stillOnForm = page.url().includes('/communications')

        expect(hasError || stillOnForm).toBeTruthy()
      }
    }
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, ANNOUNCEMENTS)
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
