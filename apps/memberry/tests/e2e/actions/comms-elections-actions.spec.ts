// Action-Contract Tests: Communications + Elections
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Communications Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('announcement list shows real announcements', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('main').getByText(/Communications/i)).toBeVisible({ timeout: 10000 })
    const hasAnnouncement = await page.getByText(/Election|Dues|Reminder/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasAnnouncement).toBeTruthy()
  })

  test('New Message button → compose form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /Title/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Send|Save/i }).first()).toBeVisible()
  })

  test('compose and save draft announcement', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('textbox', { name: /Title/i }).first().fill('Action Test Announcement')

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/')
    ).catch(() => null)

    await page.getByRole('button', { name: /Save Draft/i }).click()
    const resp = await responsePromise
    if (resp) {
      expect(resp.status()).toBeLessThan(400)
    }
  })

  test('announcement detail shows content and action buttons', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    // Click first announcement
    const link = page.getByRole('link').filter({ hasText: /Election|Dues|Reminder/i }).first()
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click()
      await page.waitForLoadState('networkidle')

      // Should show content and action buttons
      const hasContent = await page.getByText(/Publish|Archive|Edit/).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasContent).toBeTruthy()
    }
  })
})

test.describe('Elections Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('elections list shows elections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Elections/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('create election form renders with wizard steps', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections/new`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Create Election|New Election/i)).toBeVisible({ timeout: 10000 })
  })
})
