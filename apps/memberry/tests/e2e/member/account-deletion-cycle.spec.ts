/**
 * T4 — Account deletion: request → grace banner; cancel → reverts.
 *
 * Real UI: signs up a fresh user (so this spec can mutate deletion
 * state without affecting seeded personas), opens /my/settings, clicks
 * Delete Account → types DELETE → Confirm Delete, asserts the
 * "Account deletion scheduled" banner mounts. Then clicks Cancel
 * Deletion and asserts the banner unmounts and the Delete Account
 * button comes back.
 *
 * Critical-gap proof: existing member/account-deletion.spec.ts and
 * delete-account.spec.ts only verify the dialog renders. Neither
 * exercises the actual POST /persons/me/delete + POST /persons/me/
 * cancel-delete state transitions.
 */

import { test, expect } from '../helpers/test-fixture'
import { signUp } from '../helpers/auth'

test.describe.configure({ mode: 'serial' })

test.describe('T4 — Account deletion cycle (request + cancel)', () => {
  test('request schedules deletion, cancel reverts to default state', async ({ page }) => {
    // Fresh user → their better-auth hook autocreates a person row, so the
    // /persons/me/delete endpoint has something to schedule.
    await signUp(page)

    await page.goto('/my/settings')

    // Land in the General tab → Danger Zone.
    await expect(page.getByText(/danger zone/i)).toBeVisible({
      timeout: 15000,
    })

    const deleteBtn = page.getByRole('button', { name: /^delete account$/i })
    await expect(deleteBtn).toBeVisible({ timeout: 10000 })
    await deleteBtn.click()

    // Confirm form mounts; type DELETE to enable the destructive button.
    await expect(page.getByText(/type delete to confirm/i)).toBeVisible({
      timeout: 5000,
    })
    await page.getByPlaceholder('DELETE').fill('DELETE')

    const confirmBtn = page.getByRole('button', { name: /confirm delete/i })
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 })

    // Click → wait for POST /api/persons/me/delete to succeed.
    const requestReq = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith('/api/persons/me/delete') &&
        r.status() < 300,
      { timeout: 15000 },
    )
    await confirmBtn.click()
    const requestResp = await requestReq
    expect(requestResp.status()).toBeLessThan(300)

    // Sonner toast confirms scheduling.
    await expect(
      page.getByText(/account deletion scheduled/i).first(),
    ).toBeVisible({ timeout: 10000 })

    // The Danger Zone now shows the warning banner + Cancel Deletion
    // button — proves the GET /persons/me refetched the deletionScheduledAt.
    await expect(
      page.getByText(/account deletion scheduled/i).first(),
    ).toBeVisible({ timeout: 10000 })
    const cancelBtn = page.getByRole('button', { name: /cancel deletion/i })
    await expect(cancelBtn).toBeVisible({ timeout: 10000 })

    // ---- Cancel half-cycle ----
    const cancelReq = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith('/api/persons/me/cancel-delete') &&
        r.status() < 300,
      { timeout: 15000 },
    )
    await cancelBtn.click()
    const cancelResp = await cancelReq
    expect(cancelResp.status()).toBeLessThan(300)

    await expect(
      page.getByText(/account deletion cancelled/i).first(),
    ).toBeVisible({ timeout: 10000 })

    // The banner unmounts and Delete Account comes back.
    await expect(
      page.getByRole('button', { name: /^delete account$/i }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: /cancel deletion/i }),
    ).toHaveCount(0, { timeout: 5000 })
  })
})
