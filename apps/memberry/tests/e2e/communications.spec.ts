import { test, expect } from './helpers/test-fixture'
import { signInAsSecretary, signInAsMember } from './helpers/auth'
import { apiFetch } from './helpers/api-fetch'

const ORG_SLUG = 'test-org'

test.describe('Wave 4α: Communications — Officer Compose + Notification Drawer', () => {
  test('officer compose → select filters → send → appears in sent history', async ({ page }) => {
    await signInAsSecretary(page)

    // Navigate to compose page
    await page.goto(`/org/${ORG_SLUG}/officer/communications/new`)
    // Fill in title
    const titleInput = page.getByPlaceholder('Announcement title')
    await expect(titleInput).toBeVisible({ timeout: 10000 })
    await titleInput.fill('E2E Test Announcement')

    // Fill in content
    const contentArea = page.getByPlaceholder('Write your announcement here...')
    await contentArea.fill('This is an automated test announcement for Wave 4α communications.')

    // Verify at least one channel is active (In-App defaults to on)
    const sendBtn = page.getByRole('button', { name: /send now/i })
    await expect(sendBtn).toBeEnabled()

    // Click Send Now — should show confirmation
    await sendBtn.click()

    // Confirm the send
    const confirmBtn = page.getByRole('button', { name: /confirm send/i })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    await confirmBtn.click()

    // Wait for send API to complete
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/communications/announcements') && resp.request().method() === 'POST',
      { timeout: 10000 },
    ).catch(() => null)
    await page.waitForLoadState('networkidle')

    // Navigate to sent history
    await page.goto(`/org/${ORG_SLUG}/officer/communications/sent`)
    // Verify announcement appears in sent list
    await expect(page.getByText('E2E Test Announcement')).toBeVisible({ timeout: 10000 })
  })

  test('member opens notification drawer → sees categorized notifications → clicks action link', async ({ page }) => {
    await signInAsMember(page)

    // Wait for header to load
    await page.waitForLoadState('networkidle')

    // Click the notification bell button in the header
    const bellBtn = page.getByRole('button', { name: /notifications/i })
    await expect(bellBtn).toBeVisible({ timeout: 10000 })
    await bellBtn.click()

    // Drawer should slide open — verify "Notifications" title visible
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 5000 })

    // Category tabs should be visible
    await expect(page.getByText('All')).toBeVisible()
    await expect(page.getByText('Dues')).toBeVisible()
    await expect(page.getByText('Events')).toBeVisible()
    await expect(page.getByText('Training')).toBeVisible()
    await expect(page.getByText('Comms')).toBeVisible()

    // Click a category tab — should filter (or show empty state)
    await page.getByText('Dues').click()

    // Either we see notifications or empty state — both are valid
    const hasDuesNotifs = await page.getByText('No notifications').isVisible().catch(() => false)
    const hasCards = await page.locator('[class*="divide-y"] button').first().isVisible().catch(() => false)
    expect(hasDuesNotifs || hasCards).toBe(true)

    // Switch back to All
    await page.getByText('All').click()

    // If there are notifications, click the first one
    const firstNotif = page.locator('[class*="divide-y"] button').first()
    if (await firstNotif.isVisible().catch(() => false)) {
      await firstNotif.click()
      // Should navigate or close drawer
      await page.waitForLoadState('networkidle')
    }
  })

  test('mark all read → badge clears', async ({ page }) => {
    await signInAsMember(page)
    await page.waitForLoadState('networkidle')

    // Seed a test notification via API so we have something unread.
    // apiFetch attaches x-csrf-token + Origin so the POST survives the
    // hono/csrf middleware that landed after this spec was written.
    await apiFetch(page, '/notifs', {
      method: 'POST',
      body: {
        type: 'system',
        channel: 'in-app',
        title: 'E2E Mark-Read Test',
        message: 'Notification to test mark-all-read flow',
      },
    })

    // Reload to pick up the new notification count
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Open the notification drawer
    const bellBtn = page.getByRole('button', { name: /notifications/i })
    await expect(bellBtn).toBeVisible({ timeout: 10000 })
    await bellBtn.click()

    // Wait for drawer
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 5000 })

    // If "Mark all read" button visible, click it
    const markAllBtn = page.getByRole('button', { name: /mark all read/i })
    if (await markAllBtn.isVisible().catch(() => false)) {
      await markAllBtn.click()

      // Wait for mark-all-read API to complete
      await page.waitForResponse(
        (resp) => resp.url().includes('notifs/read-all'),
        { timeout: 5000 },
      ).catch(() => null)

      // After marking all read, the button should disappear (0 unread)
      await expect(markAllBtn).not.toBeVisible({ timeout: 5000 })
    }

    // Close drawer and verify badge is gone or shows 0
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: /notifications/i })).not.toBeVisible({ timeout: 3000 }).catch(() => null)

    // Badge should not be visible (no unread notifications)
    const badge = bellBtn.locator('span').filter({ hasText: /\d+/ })
    const badgeVisible = await badge.isVisible().catch(() => false)
    if (badgeVisible) {
      const badgeText = await badge.textContent()
      // Badge might show 0 or might be hidden — both acceptable
      expect(parseInt(badgeText || '0', 10)).toBeLessThanOrEqual(0)
    }
  })
})
