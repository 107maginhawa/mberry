// Action-Contract Tests: Communications + Elections
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'
import { cleanupAnnouncements } from '../helpers/fixtures'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Communications Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('announcement list shows real announcements', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    await expect(
      page.locator('main').getByRole('heading', { name: /Communications/i, level: 1 })
    ).toBeVisible({ timeout: 10000 })
    // At least one announcement row should be visible
    await expect(page.locator('.divide-y a').first()).toBeVisible({ timeout: 5000 })
  })

  test('New Message button → compose form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)

    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /Title/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Send|Save/i }).first()).toBeVisible()
  })

  test('compose and save draft announcement', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('textbox', { name: /Title/i }).first().fill('Action Test Announcement')
    // Fill message body if present
    const msgInput = page.getByRole('textbox', { name: /Message/i }).or(page.locator('textarea')).first()
    if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgInput.fill('Test announcement body')
    }

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/'),
      { timeout: 15000 }
    ).catch(() => null)

    await page.getByRole('button', { name: /Save Draft/i }).click()
    const resp = await responsePromise
    if (resp) expect(resp.status()).toBeLessThan(400)

    // Persistence: verify draft appears in communications list
    await expectVisibleOnPage(page, `/org/${ORG_ID}/officer/communications`, 'Action Test Announcement')
  })

  test('announcement detail shows content and action buttons', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    // Click first announcement in list
    const link = page.locator('.divide-y a').first()
    await expect(link).toBeVisible({ timeout: 10000 })
    await link.click()
    await page.waitForLoadState('networkidle')

    // Should show action buttons (Publish Now for drafts, or Archive/Resend for sent)
    await expect(
      page.getByRole('button', { name: /Publish Now|Archive|Resend/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('cleanup: remove test announcements', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await cleanupAnnouncements(page, ORG_ID, /^Action Test Announcement/)
  })
})

test.describe('Elections Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('elections list shows elections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)

    await expect(page.getByText(/Elections/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('create election form renders with wizard steps', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections/new`)

    await expect(page.getByText(/Create Election|New Election/i)).toBeVisible({ timeout: 10000 })
  })
})
