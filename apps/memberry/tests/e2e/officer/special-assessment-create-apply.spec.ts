// MISSING-WORKFLOW — Special Assessment: create → persist → apply → member sees charge
//
// A Treasurer/President creates a one-off special assessment through the real
// officer UI (the New Assessment dialog on
// /org/$org/officer/finances/assessments), and we prove the full lifecycle with
// REAL DATA + state changes — not selectors:
//
//   1. CREATE (real POST 201) — the dialog persists a draft assessment with the
//      exact title + ₱ amount we typed.
//   2. PERSIST — a full page RELOAD re-fetches from the wire and still shows the
//      assessment with its real name, ₱ amount, and a "Draft" status badge.
//   3. APPLY (real POST 200) — clicking Apply generates dues invoices for the
//      targeted members; a RELOAD shows the status badge flip Draft → Active and
//      a real collection figure ("0/1 paid").
//   4. MEMBER-SIDE EFFECT — the targeted member, in their OWN fresh session,
//      sees the new charge on /org/$org/dues: an outstanding SA-* invoice for
//      the exact amount, plus a durable independent API read-back confirming the
//      invoice belongs to that member at that amount.
//
// Isolation: runs against a private org (POST /test/isolated-fixture) seeded
// with ZERO extra members and the seeded member enrolled as the ONLY active
// member — so Apply targets exactly one person and the "0/1 paid" collection
// figure is deterministic under parallel workers (no shared-seed contamination).
//
// Existing coverage that this UPGRADES (does not duplicate):
//   - officer/finances-coverage.spec.ts only READS the pre-seeded
//     "Building Fund Special Levy" assessment list. It never creates one,
//     never applies one, and never checks the member-side effect.
//   - member/dues.spec.ts is selector-only ("@selector-only-ok") — it asserts a
//     dues *state* renders but never that an officer action produced a charge.
//   - cross-persona/treasurer-records-dues-*.spec.ts covers the manual
//     record-payment money path, a different workflow.

import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'
import { withIsolatedFixture } from '../helpers/isolated-fixture'
import { independentRead } from '../helpers/independent-read'
import { freshAuthState } from '../helpers/programmatic-auth'
import { SEED_MEMBER_EMAIL } from '../helpers/test-config'

test.use({ authRole: 'officer' })

test.describe('Officer special assessment — create, persist, apply, member sees charge', () => {
  // Private org: the seeded member is the ONLY active member (memberCount: 0 +
  // memberEmail enrolls just them). Apply therefore targets exactly 1 person →
  // deterministic "0/1 paid". The seeded president (test@memberry.ph → the
  // 'officer' authRole) gets a President term so the create/apply position gate
  // (Treasurer|President) passes.
  const fx = withIsolatedFixture(test, {
    memberCount: 0,
    memberEmail: SEED_MEMBER_EMAIL,
  })

  test('officer creates a one-off levy, applies it, and the targeted member sees the charge', async ({
    page,
    browser,
  }) => {
    const orgId = fx().orgId
    // Unique title + amount per run so every assertion is specific and the
    // rendered "₱X,XXX.00" can't collide with another assessment's figure.
    const stamp = Date.now()
    const name = `Roof Repair Levy ${stamp}`
    // Whole pesos → exact centavos so display is "₱<peso>.00".
    const pesos = 1000 + (stamp % 9000) // 1000..9999 PHP
    const amountCentavos = pesos * 100
    const pesoLabel = `₱${pesos.toLocaleString('en-US')}.00`

    // ---- 1. CREATE via the real dialog (capture the POST) -----------------
    const createRespP = captureRouteHydration(page, /\/special-assessments(\?|$)/, {
      method: 'POST',
    })
    await page.goto(`/org/${orgId}/officer/finances/assessments`)
    await expect(
      page.getByRole('heading', { name: /special assessments/i }),
    ).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /new assessment/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/new special assessment/i)).toBeVisible({ timeout: 10000 })

    await dialog.getByLabel('Name').fill(name)
    // Amount field is captured in centavos (label "Amount (centavos)").
    await dialog.getByLabel(/amount/i).fill(String(amountCentavos))
    await dialog.getByLabel(/due date/i).fill('2026-12-31')
    // appliesTo defaults to "All Members" — leave it.

    await dialog.getByRole('button', { name: /create draft/i }).click()

    const createResp = await createRespP
    expect(createResp?.status(), 'create special-assessment POST must 201').toBe(201)
    const created = (await createResp!.json().catch(() => null)) as
      | { id?: string; name?: string; amount?: number; status?: string }
      | null
    // Real fields round-trip on the wire.
    expect(created?.name, 'created assessment name round-trips').toBe(name)
    expect(created?.amount, 'created assessment amount round-trips (centavos)').toBe(
      amountCentavos,
    )
    expect(created?.status, 'new assessment starts as a draft').toBe('draft')
    const assessmentId = created?.id
    expect(assessmentId, 'created assessment has an id').toBeTruthy()

    // Dialog closes; the new row appears in the list.
    await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 10000 })

    // ---- 2. PERSIST across a full reload (re-fetch from the wire) ---------
    const reloadListP = captureRouteHydration(page, /\/special-assessments\//, {
      method: 'GET',
    })
    await page.reload()
    const reloadList = await reloadListP
    expect(reloadList?.status(), 'list GET on reload must 200').toBe(200)

    const row = page.getByRole('row', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    await expect(row, 'assessment survives reload (durable)').toBeVisible({ timeout: 10000 })
    // Real money figure + draft status badge persist on the durable row.
    await expect(row.getByText(pesoLabel)).toBeVisible({ timeout: 10000 })
    await expect(row.getByText(/^Draft$/)).toBeVisible({ timeout: 10000 })

    // ---- 3. APPLY → invoices generated; status flips Draft → Active ------
    // The Apply button fires window.confirm() before the POST — auto-accept it.
    page.on('dialog', (d) => d.accept())
    const applyRespP = captureRouteHydration(
      page,
      new RegExp(`/special-assessments/${assessmentId}/apply`),
      { method: 'POST' },
    )
    await row.getByRole('button', { name: /apply assessment/i }).click()
    const applyResp = await applyRespP
    expect(applyResp?.status(), 'apply POST must 200').toBe(200)
    const applyBody = (await applyResp!.json().catch(() => null)) as
      | { invoicesCreated?: number }
      | null
    // The single targeted member gets exactly one invoice.
    expect(
      applyBody?.invoicesCreated,
      'apply generated one invoice for the lone targeted member',
    ).toBe(1)

    // STATE CHANGE on reload: badge flips Draft → Active, collection shows 0/1.
    await page.reload()
    const activeRow = page.getByRole('row', {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    })
    await expect(activeRow).toBeVisible({ timeout: 10000 })
    await expect(
      activeRow.getByText(/^Active$/),
      'status badge flipped Draft → Active after apply',
    ).toBeVisible({ timeout: 10000 })
    await expect(
      activeRow.getByText(/0\/1 paid/),
      'collection reflects the single targeted member, none paid yet',
    ).toBeVisible({ timeout: 10000 })

    // ---- 4. MEMBER-SIDE EFFECT: the charge shows on /org/$org/dues -------
    // Fresh member session (separate browser context) — the targeted member
    // navigates to their own dues page and must see the new outstanding charge.
    const memberCtx = await browser.newContext({
      storageState: await freshAuthState('member'),
    })
    try {
      const memberPage = await memberCtx.newPage()
      const invoicesP = captureRouteHydration(memberPage, /\/dues-invoices(\?|$)/, {
        method: 'GET',
      })
      await memberPage.goto(`/org/${orgId}/dues`)
      await expect(
        memberPage.getByRole('heading', { name: 'My Dues', level: 1 }),
      ).toBeVisible({ timeout: 15000 })

      const invoicesResp = await invoicesP
      expect(invoicesResp?.status(), 'member dues-invoices GET must 200').toBe(200)

      // The SA-* invoice surfaces as an outstanding charge with the exact amount.
      // member dues page renders invoiceNumber + amount (₱amount via CountUp).
      await expect(
        memberPage.getByText(/^SA-/).first(),
        'member sees the special-assessment invoice number',
      ).toBeVisible({ timeout: 10000 })
      await expect(
        memberPage.getByText(pesoLabel).first(),
        'member sees the special-assessment amount as an outstanding charge',
      ).toBeVisible({ timeout: 10000 })
      // The outstanding section + pay-proof affordance render for this open charge.
      await expect(
        memberPage.getByText(/Upload your GCash screenshot|Pay Dues/i).first(),
        'the SA invoice is payable (open obligation), not already settled',
      ).toBeVisible({ timeout: 10000 })

      await memberPage.close()
    } finally {
      await memberCtx.close()
    }

    // ---- Clause-4 durable oracle: independent API read confirms the charge --
    // Re-verify from a brand-new member session reading durable state directly,
    // not the UI we just drove.
    const oracle = await independentRead<{
      status: number
      invoice?: { invoiceNumber?: string; totalAmount?: number; status?: string }
    }>({ email: SEED_MEMBER_EMAIL, password: process.env.TEST_PASSWORD ?? 'TestPass123!' }, async (api) => {
      const res = await api.get<{
        data?: Array<{ invoiceNumber?: string; totalAmount?: number; status?: string }>
      }>(`/association/member/dues-invoices?organizationId=${orgId}&limit=10`, { orgId })
      const rows = res.data?.data ?? []
      const saInvoice = rows.find((r) => (r.invoiceNumber ?? '').startsWith('SA-'))
      return { status: res.status, invoice: saInvoice }
    })
    expect(oracle.status, 'member can read their dues invoices durably').toBe(200)
    expect(
      oracle.invoice,
      'a special-assessment (SA-*) invoice durably exists for the targeted member',
    ).toBeTruthy()
    expect(
      oracle.invoice?.totalAmount,
      'the durable charge amount matches the assessment amount',
    ).toBe(amountCentavos)
  })
})
