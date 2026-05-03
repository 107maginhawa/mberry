// Phase 3: Cross-surface consistency tests
// Verifies data created in one view appears in another
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { expectVisibleOnPage } from '../helpers/persistence'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Cross-Surface Consistency', () => {
  test('event created by officer appears in event list', async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
    const eventName = `CrossSurface Event ${Date.now()}`

    // Create event
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await expect(page.getByText(/Create Event/i)).toBeVisible({ timeout: 10000 })
    await page.getByRole('textbox', { name: /Event Title/i }).fill(eventName)
    await page.getByRole('textbox', { name: /Start/i }).fill('2026-12-15T09:00')
    await page.getByRole('textbox', { name: /End/i }).fill('2026-12-15T17:00')

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/events/create/') && resp.status() === 201
    )
    await page.getByRole('button', { name: /Publish/i }).click()
    await responsePromise

    // Verify appears in officer event list
    await expectVisibleOnPage(page, `/org/${ORG_ID}/officer/events`, eventName)
  })

  test('announcement created as draft appears in list', async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
    const title = `CrossSurface Ann ${Date.now()}`

    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })
    await page.getByRole('textbox', { name: /Title/i }).first().fill(title)

    const msgInput = page.locator('textarea').first()
    if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgInput.fill('Cross surface test body')
    }

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/'),
      { timeout: 15000 }
    ).catch(() => null)

    await page.getByRole('button', { name: /Save Draft/i }).click()
    await responsePromise

    // Verify appears in communications list
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Look in Drafts tab
    const draftsTab = page.getByRole('button', { name: /Drafts/i }).or(page.getByText(/Drafts/i))
    if (await draftsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await draftsTab.click()
      await page.waitForTimeout(1000)
    }
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  })
})
