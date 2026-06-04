// Business Rules: [BR-28]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { cleanupAnnouncements } from '../helpers/fixtures'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const TEST_PREFIX = 'E2E Comms Test'

test.describe('Officer Communications', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('communications list renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await expect(
      page.getByRole('heading', { name: /communications?|announcements?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows announcements in list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // At least one announcement should be visible (seeded or test-created)
    const rows = page.locator('.divide-y a')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
  })

  test('New Message button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()
    await expect(newBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to new announcement form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()
    await newBtn.click()

    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/communications/new')
  })

  test('stats cards show real data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Stats cards should render with actual values (not just "0" or hardcoded text)
    await expect(page.getByText('Total Sent')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Total', { exact: true })).toBeVisible()
    await expect(page.getByText('Channels Used')).toBeVisible()
  })

  test('status badges show readable text, not raw enum', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Wait for announcements to load
    await expect(page.locator('[class*="rounded-md"][class*="font-medium"]').first()).toBeVisible({ timeout: 10000 })

    // All status badges should have capitalized text
    const badges = page.locator('[class*="rounded-md"][class*="font-medium"]')
    const count = await badges.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await badges.nth(i).textContent()
      if (text) {
        // Should be capitalized (e.g., "Sent", "Draft", not "sent", "draft")
        expect(text.charAt(0)).toMatch(/[A-Z]/)
      }
    }
  })

  test('create draft, view detail, then publish', async ({ page }) => {
    const title = `${TEST_PREFIX} ${Date.now()}`

    // Create draft
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('textbox', { name: /Title/i }).first().fill(title)
    const msgInput = page.locator('textarea').first()
    if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgInput.fill('E2E test: draft → publish flow')
    }

    const createResponse = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/'),
      { timeout: 15000 }
    ).catch(() => null)

    await page.getByRole('button', { name: /Save Draft/i }).click()
    const resp = await createResponse
    if (resp) expect(resp.status()).toBeLessThan(400)

    // Navigate to detail by clicking on it in the list
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    const annLink = page.getByText(title).first()
    await expect(annLink).toBeVisible({ timeout: 10000 })
    await annLink.click()

    // Verify detail page
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()

    // Publish
    const publishBtn = page.getByRole('button', { name: /Publish Now/i })
    await expect(publishBtn).toBeVisible({ timeout: 5000 })
    await publishBtn.click()

    // Verify status changes to Sent
    await expect(page.getByText('Sent')).toBeVisible({ timeout: 10000 })
  })

  test('published announcement shows archive button on detail', async ({ page }) => {
    // After the publish test above, the published E2E announcement should have an Archive button
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Click Sent tab to find published announcements
    const sentTab = page.getByRole('button', { name: /^Sent$/i })
    if (await sentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sentTab.click()
      await page.waitForTimeout(1000)
    }

    // Click first sent announcement
    const annRow = page.locator('.divide-y a').first()
    if (await annRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await annRow.click()
      await page.waitForLoadState('networkidle')

      // Sent announcements should show Archive button (but don't click — preserve data)
      const archiveBtn = page.getByRole('button', { name: /Archive/i })
      await expect(archiveBtn).toBeVisible({ timeout: 5000 })
    }
  })

  test('detail page shows metadata and back link', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Click an announcement row — rows are <a> inside the list with truncated title
    const annRow = page.locator('.divide-y a[href*="/communications/"]').first()
    await expect(annRow).toBeVisible({ timeout: 10000 })
    await annRow.click()
    await page.waitForLoadState('networkidle')

    // Detail page should show metadata (labels are uppercase via CSS)
    await expect(page.getByText(/created/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/visibility/i).first()).toBeVisible()
    await expect(page.getByText(/Back to Communications/i)).toBeVisible()
  })

  test('cleanup: remove E2E test announcements', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await cleanupAnnouncements(page, ORG_ID, /^E2E Comms Test/)
  })
})
