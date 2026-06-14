// Action-Contract Tests: Communications + Elections
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleOnPage } from '../helpers/persistence'
import { withIsolatedFixture } from '../helpers/isolated-fixture'


test.use({ authRole: 'officer' })

test.describe('Communications Actions', () => {
  // F3: announcement create/save-draft mutators move to isolated org so
  // they don't poison officer/communications list readers.
  const fx = withIsolatedFixture(test, { memberCount: 1 })

  test('announcement list shows the page heading', async ({ page }) => {
    await page.goto(`/org/${fx().orgId}/officer/communications`)
    await expect(
      page.locator('main').getByRole('heading', { name: /Communications/i, level: 1 })
    ).toBeVisible({ timeout: 10000 })
  })

  test('New Message button → compose form renders', async ({ page }) => {
    await page.goto(`/org/${fx().orgId}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /Title/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Send|Save/i }).first()).toBeVisible()
  })

  test('compose and save draft announcement', async ({ page }) => {
    await page.goto(`/org/${fx().orgId}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('textbox', { name: /Title/i }).first().fill('Action Test Announcement')
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

    await expectVisibleOnPage(page, `/org/${fx().orgId}/officer/communications`, 'Action Test Announcement')
  })

  // F3 cleanup handled by withIsolatedFixture afterAll teardown.
})

test.describe('Elections Actions', () => {
  // F3: election create form opens here, isolation prevents the new
  // election from polluting officer/elections list assertions.
  const fx = withIsolatedFixture(test, { memberCount: 1 })

  test('elections list page renders heading', async ({ page }) => {
    await page.goto(`/org/${fx().orgId}/officer/elections`)
    await expect(
      page.getByRole('heading', { name: /elections/i, level: 1 }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('create election form renders', async ({ page }) => {
    await page.goto(`/org/${fx().orgId}/officer/elections/new`)
    await expect(page.getByText(/Create Election|New Election/i)).toBeVisible({ timeout: 10000 })
  })
})
