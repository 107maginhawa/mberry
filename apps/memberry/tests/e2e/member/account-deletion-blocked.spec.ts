/**
 * AXIS-4 — Account deletion BLOCKED by a safety guard (proven through the UI).
 *
 * The existing account-deletion specs only cover the HAPPY path:
 *   - delete-account.spec.ts / account-deletion.spec.ts — the dialog/form renders.
 *   - account-deletion-cycle.spec.ts / deletion-grace-banner.spec.ts — a FRESH
 *     signed-up user (no memberships, no payments, no officer term) requests
 *     deletion → the 30-day grace banner mounts → cancel reverts.
 *
 * None of them exercise the M2-R5 safety guards in
 * services/api-ts/src/handlers/person/requestMyAccountDeletion.ts, which refuse
 * deletion (HTTP 422) when the person has an in-flight dues payment
 * (status pending | submitted | underReview → code PENDING_PAYMENTS) or is the
 * sole active officer of an org (code SOLE_OFFICER). This spec fills that gap by
 * driving the REAL settings UI and asserting:
 *   1. the deletion POST is rejected with 422 + the PENDING_PAYMENTS block code,
 *   2. the UI surfaces the rejection (error toast, no "scheduled" state),
 *   3. the account is NOT scheduled — no scheduled banner in Settings, no
 *      app-wide deletion-grace banner on the dashboard, and (clause-4
 *      independent read) the durable person record carries neither
 *      deletionRequestedAt nor deletionScheduledAt afterwards.
 *
 * Seeding: the seeded persona `member@memberry.ph` (Miguel Bautista) already has
 * an in-flight dues payment, so requestMyAccountDeletion's pending-payment guard
 * fires first — no extra seeding is required. This was verified against the live
 * stack (POST /persons/me/delete → 422 { code: 'PENDING_PAYMENTS' }).
 *
 * SOLE_OFFICER note: the same handler enforces a sole-active-officer guard, but
 * the pending-payment check runs first and short-circuits for this persona, and
 * the seeded member holds no officer term — so the SOLE_OFFICER path is not
 * reproducible through this member's UI. It is covered at the integration layer
 * (services/api-ts/src/handlers/person/person-deletion.integration.test.ts —
 * "SOLE_OFFICER guard (real DB)").
 */
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'
import { independentRead } from '../helpers/independent-read'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

// The deletion POST the UI fires from both surfaces.
const DELETE_POST = /\/persons\/me\/delete(?:[/?]|$)/
// Settings → Account hydrates the signed-in person via GET /persons/me.
const PERSON_ME = /\/persons\/me(?:[/?]|$)/

test.use({ authRole: 'member' })

test.describe('AXIS-4: Account deletion blocked by safety guard', () => {
  test('Danger Zone (/my/settings): blocked deletion shows error + does NOT schedule', async ({
    page,
  }) => {
    await page.goto('/my/settings')

    // Land in the General tab → Danger Zone. A "scheduled" banner must NOT be
    // present up front (this persona has no pending deletion).
    await expect(page.getByText(/danger zone/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/account deletion scheduled/i)).toHaveCount(0)

    const deleteBtn = page.getByRole('button', { name: /^delete account$/i })
    await expect(deleteBtn).toBeVisible({ timeout: 10000 })
    await deleteBtn.click()

    // Confirm form mounts → type DELETE to arm the destructive button.
    await expect(page.getByText(/type delete to confirm/i)).toBeVisible({
      timeout: 5000,
    })
    await page.getByPlaceholder('DELETE').fill('DELETE')

    const confirmBtn = page.getByRole('button', { name: /confirm delete/i })
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 })

    // Capture the rejected POST. The guard returns 422 — NOT a 2xx schedule.
    const blockedRespP = captureRouteHydration(page, DELETE_POST, {
      method: 'POST',
    })
    await confirmBtn.click()

    const blockedResp = await blockedRespP
    expect(blockedResp, 'expected a POST /persons/me/delete response').not.toBeNull()
    expect(blockedResp?.status()).toBe(422)

    // The wire body carries the human-readable block reason + machine code.
    const body = (await blockedResp?.json().catch(() => null)) as
      | { code?: string; message?: string }
      | null
    expect(body?.code).toBe('PENDING_PAYMENTS')
    expect(body?.message ?? '').toMatch(/outstanding dues|pending|resolved/i)

    // The UI surfaces the rejection (Sonner error toast) instead of scheduling.
    await expect(
      page.getByText(/422|unprocessable|failed to schedule/i).first(),
    ).toBeVisible({ timeout: 10000 })

    // CRITICAL: the account is NOT scheduled. The confirm form is still open
    // (handleDelete only closes it on success) and the warning banner that
    // appears on a successful schedule never mounts.
    await expect(page.getByPlaceholder('DELETE')).toBeVisible()
    await expect(page.getByText(/account deletion scheduled/i)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /cancel deletion/i }),
    ).toHaveCount(0)
  })

  test('Settings → Account (/settings/account): blocked deletion does NOT schedule + no app-wide banner', async ({
    page,
  }) => {
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/settings/account')

    // Prove the route hydrated the signed-in person off the wire (not a shell).
    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    // Pre-state: the deletion card offers "Request Account Deletion", not the
    // post-request "Cancel Deletion Request".
    await expect(
      page.getByRole('button', { name: /request account deletion/i }),
    ).toBeVisible({ timeout: 10000 })

    await page
      .getByRole('button', { name: /request account deletion/i })
      .click()

    // Confirm dialog → fire the deletion; the guard rejects it with 422.
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 10000 })

    const blockedRespP = captureRouteHydration(page, DELETE_POST, {
      method: 'POST',
    })
    await page
      .getByRole('button', { name: /yes, delete my account/i })
      .click()

    const blockedResp = await blockedRespP
    expect(blockedResp?.status()).toBe(422)
    const body = (await blockedResp?.json().catch(() => null)) as
      | { code?: string }
      | null
    expect(body?.code).toBe('PENDING_PAYMENTS')

    // The SDK mutation's onError surfaces a failure toast — NOT the success
    // "deletion requested" toast.
    await expect(
      page.getByText(/failed to request deletion/i).first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText(/30 days to cancel|deletion requested/i),
    ).toHaveCount(0)

    // The card still offers the request action (not the scheduled "Cancel
    // Deletion Request" affordance) — deletion was refused, not scheduled.
    await expect(
      page.getByRole('button', { name: /request account deletion/i }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: /cancel deletion request/i }),
    ).toHaveCount(0)

    // App-wide proof: the deletion-grace banner (FIX-010) is mounted in the
    // _authenticated layout whenever a deletion is scheduled. A blocked request
    // must leave it absent on a NON-settings page.
    await page.goto('/dashboard')
    await expect(page.getByTestId('deletion-grace-banner')).toHaveCount(0, {
      timeout: 10000,
    })
  })

  test('independent read: durable person record was NOT marked for deletion', async ({
    page,
  }) => {
    // Drive one blocked attempt through the real UI...
    await page.goto('/my/settings')
    await expect(page.getByText(/danger zone/i)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /^delete account$/i }).click()
    await page.getByPlaceholder('DELETE').fill('DELETE')

    const blockedRespP = captureRouteHydration(page, DELETE_POST, {
      method: 'POST',
    })
    await page.getByRole('button', { name: /confirm delete/i }).click()
    expect((await blockedRespP)?.status()).toBe(422)

    // ...then re-read the durable record from a SEPARATE session (clause 4 of
    // the journey DoD). If the guard let the write through, deletionRequestedAt
    // / deletionScheduledAt would be populated here — that would be a real bug.
    const me = await independentRead(
      { email: SEED_MEMBER_EMAIL, password: TEST_PASSWORD },
      (api) =>
        api.get<{
          deletionRequestedAt?: string | null
          deletionScheduledAt?: string | null
          data?: {
            deletionRequestedAt?: string | null
            deletionScheduledAt?: string | null
          }
        }>('/persons/me'),
    )

    expect(me.status).toBe(200)
    const person = me.data?.data ?? me.data
    expect(person, 'persons/me returned a body').not.toBeNull()
    expect(person?.deletionRequestedAt ?? null).toBeNull()
    expect(person?.deletionScheduledAt ?? null).toBeNull()
  })
})
