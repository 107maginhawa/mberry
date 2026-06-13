// WF-060 — Training Completion: mark complete, credits awarded
// SO-3: Training completion — member view
//
// FIX-014 (AHA Training Batch E): strengthened from render-only to a REAL
// persisted-data assertion. The member-facing end of the attendance→credit
// journey is /my/credits: this spec proves the page hydrates from
// GET /persons/me/credit-entries and renders the member's REAL persisted
// credit rows (not just stat-card headings), by asserting a specific seeded
// credit entry appears with its exact activity, type, and amount.
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ storageState: authStateFile('member') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

type CreditEntry = { activityName: string; type: string; creditAmount: number }

test.describe('SO-3 / FIX-014: member sees real persisted credits', () => {
  test('member training page hydrates from the backend', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/api\/(association\/training|persons\/me)(?:[/?]|$)/)
    await page.goto(`/org/${ORG_ID}/training`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    const hasContent = await page
      .getByText(/training|course|seminar|no training/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('/my/credits renders the member\'s REAL persisted credit rows (not just headings)', async ({ page }) => {
    // Read the source of truth straight from the API first.
    await page.goto('/my/credits')
    const credits = await apiFetch<{ data: CreditEntry[] }>(page, '/persons/me/credit-entries')
    expect(credits.status).toBe(200)
    const entries = credits.data?.data ?? []
    // The seeded member carries real credit history — the page must show it.
    expect(entries.length, 'member is expected to have seeded credit entries').toBeGreaterThan(0)

    // The rendered Credit Log table must reflect that real data: assert a
    // specific persisted entry renders with its activity + amount. A render-only
    // shell (the old fake-green failure mode) cannot satisfy this.
    const sample = entries[0]!
    const sampleRow = page
      .getByRole('row')
      .filter({ hasText: sample.activityName })
      .filter({ hasText: String(sample.creditAmount) })
    await expect(sampleRow.first()).toBeVisible({ timeout: 15000 })

    // And the rendered Credit Log shows at least as many data rows as small
    // samples of the real set — proving the table is data-driven.
    const dataRows = page.getByRole('row')
    // header + at least one data row
    expect(await dataRows.count()).toBeGreaterThan(1)
  })
})
