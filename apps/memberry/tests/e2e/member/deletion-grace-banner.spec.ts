// FIX-010 (G-09 / AC-M02-003) — app-wide account-deletion grace banner.
//
// Before this fix, `deletionScheduledAt` surfaced only inside Settings →
// General, so a member with a pending deletion saw no app-wide warning and
// could lose data by surprise. The banner now lives in the _authenticated
// layout. This proves the full journey on a NON-settings page:
//   request deletion → dashboard shows banner → cancel from banner → reload → gone
//
// Uses a fresh signed-up user (signUp auto-creates the person via the
// Better-Auth user.create.after hook) so we never mutate shared seeded state.
import { test, expect } from '../helpers/test-fixture'
import { signUp } from '../helpers/auth'

test.describe('FIX-010 — account-deletion grace banner (app-wide)', () => {
  test('banner shows on the dashboard during grace and clears after cancel', async ({
    page,
  }) => {
    // Fresh user — signUp leaves the session authenticated on this page.
    await signUp(page)

    // 1. Request deletion via the real Settings → Account flow.
    await page.goto('/settings/account')
    await page
      .getByRole('button', { name: /request account deletion/i })
      .click()

    const requestResp = page.waitForResponse(
      (r) =>
        r.url().includes('/persons/me/delete') &&
        r.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: /yes, delete my account/i })
      .click()
    expect((await requestResp).ok()).toBeTruthy()

    // 2. The banner must be visible app-wide — prove it on the dashboard
    //    (a page OTHER than Settings → Account).
    await page.goto('/dashboard')
    const banner = page.getByTestId('deletion-grace-banner')
    await expect(banner).toBeVisible({ timeout: 10000 })
    await expect(banner).toContainText(/scheduled for deletion/i)

    // 3. Cancel directly from the banner.
    const cancelResp = page.waitForResponse(
      (r) =>
        r.url().includes('/persons/me/cancel-delete') &&
        r.request().method() === 'POST',
    )
    await banner.getByRole('button', { name: /cancel deletion/i }).click()
    expect((await cancelResp).ok()).toBeTruthy()

    // 4. After a reload the banner is gone (state really persisted server-side).
    await page.reload()
    await expect(page.getByTestId('deletion-grace-banner')).toHaveCount(0, {
      timeout: 10000,
    })
  })
})
