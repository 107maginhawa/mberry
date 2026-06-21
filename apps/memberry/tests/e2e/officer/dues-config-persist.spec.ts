// SHALLOW→real upgrade — Dues config PERSISTENCE round-trip.
//
// Gap this closes: every existing dues-config spec is render-only.
//   - officer/settings.spec.ts            → "page renders with form" (h1 + a spinbutton)
//   - actions/dues-actions.spec.ts        → "dues config page loads with form"
//   - officer/officer-settings.spec.ts    → round-trips CPD credits, NOT dues money
//   - officer/finances-coverage.spec.ts   → asserts the SEEDED ₱3,000 input renders
//   None mutate the dues AMOUNT, save, reload, and prove the entered value survived.
//
// Route note (verified in src): `/officer/settings/dues` is a beforeLoad redirect
// to `/officer/finances/dues`, which mounts <DuesConfigForm>. The form's
// "Annual Dues Amount" input is bound to the org's dues-config (read GET
// /association/member/dues-configs/{orgId}; written PATCH same path). The input
// shows pesos (annualAmount cents / 100); the PATCH update path persists
// `annualAmount` + `gracePeriodDays` (see dues-config-form.utils.ts).
//
// What this asserts beyond "renders":
//   1. The settings/dues URL truly redirects onto the finances/dues config form.
//   2. Mutate amount → Save → the real PATCH wire to /dues-configs/{orgId}
//      returns 200 → reload → the EXACT entered value persists in the input.
//   3. Cross-surface: a FRESH navigation to /officer/finances/dues (separate
//      GET hydration, asserted 200) shows the same persisted value — proving the
//      saved config is durable, not just in-memory form state.
//   4. Grace-period (the other field the update path persists) round-trips too.
//   Each test restores the original value so the shared seed org is unchanged.
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// PATCH /association/member/dues-configs/{duesConfigId} — duesConfigId === orgId.
const DUES_CONFIG_PATCH = new RegExp(`/dues-configs/${ORG_ID}(?:[/?]|$)`)
// GET /association/member/dues-configs/{duesConfigId} — config hydration on load.
const DUES_CONFIG_GET = /\/dues-configs\//

/** Dismiss the NPS auto-prompt if it's covering the Save button (NpsProvider). */
async function dismissNpsIfPresent(page: import('@playwright/test').Page) {
  const npsDismiss = page.getByRole('button', { name: /dismiss survey/i })
  if (await npsDismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await npsDismiss.click()
    await expect(npsDismiss).toBeHidden({ timeout: 5000 }).catch(() => {})
  }
}

/** The "Annual Dues Amount" input — the form's first/only #defaultAmount field. */
function amountInput(page: import('@playwright/test').Page) {
  return page.locator('#defaultAmount')
}

/** The "Grace Period (days)" input. */
function graceInput(page: import('@playwright/test').Page) {
  return page.locator('#gracePeriodDays')
}

/**
 * The "Currency" Radix Select trigger. It is the FIRST combobox in the dues
 * form (Currency, then Billing Frequency, then Due-date month). The trigger
 * button's text content is the currently selected currency (PHP / USD).
 */
function currencyTrigger(page: import('@playwright/test').Page) {
  return page.locator('button[role="combobox"]').first()
}

/** Read the currently-selected currency code from the Currency trigger. */
async function readCurrency(page: import('@playwright/test').Page): Promise<string> {
  return ((await currencyTrigger(page).textContent()) ?? '').trim()
}

/** Open the Currency Select and pick the given currency code (PHP | USD). */
async function selectCurrency(page: import('@playwright/test').Page, code: string) {
  await currencyTrigger(page).click()
  await page.getByRole('option', { name: new RegExp(`^${code}$`, 'i') }).click()
  await expect(currencyTrigger(page)).toContainText(code, { timeout: 5000 })
}

async function gotoDuesConfig(page: import('@playwright/test').Page) {
  const getP = captureRouteHydration(page, DUES_CONFIG_GET)
  await page.goto(`/org/${ORG_ID}/officer/finances/dues`)
  await expect(page.getByRole('heading', { name: /dues schedule/i })).toBeVisible({ timeout: 15000 })
  // The amount input only renders once the config GET hydrates the form.
  await expect(amountInput(page)).toBeVisible({ timeout: 15000 })
  return getP
}

test.describe('Officer dues config — values persist across reload (real data)', () => {
  test('settings/dues redirects onto the finances/dues config form', async ({ page }) => {
    // The task names /officer/settings/dues; verify it actually lands on the
    // real config form (redirect target) rather than 404-ing.
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await page.waitForURL(/\/officer\/finances\/dues/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /dues schedule/i })).toBeVisible({ timeout: 15000 })
    // The form is bound to real config — the amount input carries a numeric value,
    // not an empty placeholder.
    await expect(amountInput(page)).toBeVisible({ timeout: 15000 })
    const value = await amountInput(page).inputValue()
    expect(Number(value), 'seeded dues amount must hydrate as a positive number').toBeGreaterThan(0)
  })

  test('Annual Dues Amount: mutate → save (PATCH 200) → reload → exact value persists', async ({ page }) => {
    const getP = await gotoDuesConfig(page)
    const getResp = await getP
    expect(getResp?.status(), 'dues-config GET must hydrate the form with 200').toBe(200)

    const input = amountInput(page)
    const original = await input.inputValue()
    expect(Number(original), 'original dues amount must be a positive number').toBeGreaterThan(0)

    // Pick a distinct, safe probe value (whole pesos so the cents round-trip is
    // lossless: input "3456" → 345600 cents → /100 → "3456").
    const probe = original === '3456' ? '4567' : '3456'
    expect(probe).not.toBe(original)

    await dismissNpsIfPresent(page)

    // Mutate → Save → assert the REAL update wire succeeds.
    await input.fill(probe)
    const patchP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    const patch = await patchP
    expect(patch.status(), `dues-config PATCH must succeed (got ${patch.status()})`).toBe(200)
    // The persisted body echoes the new amount in cents (probe * 100).
    const patchBody = await patch.json().catch(() => null)
    const persistedAmount = patchBody?.data?.annualAmount ?? patchBody?.annualAmount
    if (persistedAmount != null) {
      expect(Number(persistedAmount), 'PATCH response must echo new amount in cents').toBe(
        Number(probe) * 100,
      )
    }

    // Durable read 1 — reload the same page; the form re-hydrates from the DB.
    await gotoDuesConfig(page)
    await expect(amountInput(page)).toHaveValue(probe, { timeout: 15000 })

    // Restore the original so the shared seed org is left unchanged.
    await dismissNpsIfPresent(page)
    await amountInput(page).fill(original)
    const restoreP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await restoreP).status(), 'restore PATCH must succeed').toBe(200)
    await gotoDuesConfig(page)
    await expect(amountInput(page)).toHaveValue(original, { timeout: 15000 })
  })

  test('saved amount survives a fresh navigation to the finances dues schedule (cross-surface durability)', async ({
    page,
  }) => {
    // Prove the saved value is read back through a SEPARATE GET hydration on a
    // fresh navigation — not just retained in the form's in-memory state.
    await gotoDuesConfig(page)
    const input = amountInput(page)
    const original = await input.inputValue()
    expect(Number(original)).toBeGreaterThan(0)
    const probe = original === '5678' ? '6789' : '5678'

    await dismissNpsIfPresent(page)
    await input.fill(probe)
    const patchP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await patchP).status(), 'save PATCH must succeed').toBe(200)

    // Fully fresh navigation (new GET) — the dues schedule reflects the saved value.
    const getP = captureRouteHydration(page, DUES_CONFIG_GET)
    await page.goto(`/org/${ORG_ID}/officer/finances/dues`)
    await expect(page.getByRole('heading', { name: /dues schedule/i })).toBeVisible({ timeout: 15000 })
    const getResp = await getP
    expect(getResp?.status(), 'config re-read GET must return 200 with data').toBe(200)
    await expect(amountInput(page)).toHaveValue(probe, { timeout: 15000 })

    // Restore original.
    await dismissNpsIfPresent(page)
    await amountInput(page).fill(original)
    const restoreP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await restoreP).status(), 'restore PATCH must succeed').toBe(200)
    await page.goto(`/org/${ORG_ID}/officer/finances/dues`)
    await expect(amountInput(page)).toHaveValue(original, { timeout: 15000 })
  })

  test('Grace Period (days): mutate → save → reload → persists', async ({ page }) => {
    // Grace period is the other field the update path persists; it changes member
    // lapse timing, so its durability matters.
    await gotoDuesConfig(page)
    const grace = graceInput(page)
    await expect(grace).toBeVisible({ timeout: 15000 })
    const original = (await grace.inputValue()) || '30'
    const probe = original === '15' ? '21' : '15'

    await dismissNpsIfPresent(page)
    await grace.fill(probe)
    const patchP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    const patch = await patchP
    expect(patch.status(), 'grace-period PATCH must succeed').toBe(200)
    const body = await patch.json().catch(() => null)
    const persistedGrace = body?.data?.gracePeriodDays ?? body?.gracePeriodDays
    if (persistedGrace != null) {
      expect(Number(persistedGrace), 'PATCH must persist the new grace period').toBe(Number(probe))
    }

    await gotoDuesConfig(page)
    await expect(graceInput(page)).toHaveValue(probe, { timeout: 15000 })

    // Restore original.
    await dismissNpsIfPresent(page)
    await graceInput(page).fill(original)
    const restoreP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await restoreP).status(), 'restore PATCH must succeed').toBe(200)
    await gotoDuesConfig(page)
    await expect(graceInput(page)).toHaveValue(original, { timeout: 15000 })
  })

  test('Currency: change PHP↔USD → save → reload → the selected currency persists', async ({
    page,
  }) => {
    // Regression for the silent-drop bug: the update payload (buildUpdatePayload)
    // and the PATCH validator (DuesConfigUpdateRequest) previously omitted
    // `currency`, so an officer changing the currency saw it revert on reload.
    // This proves the SELECTED currency value survives a real save + re-hydration.
    await gotoDuesConfig(page)
    await expect(currencyTrigger(page)).toBeVisible({ timeout: 15000 })

    const original = await readCurrency(page)
    expect(['PHP', 'USD'], `currency must hydrate to a known code (got "${original}")`).toContain(
      original,
    )
    const probe = original === 'USD' ? 'PHP' : 'USD'

    await dismissNpsIfPresent(page)

    // Change currency → Save → the PATCH wire must carry + persist the new currency.
    await selectCurrency(page, probe)
    const patchP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    const patch = await patchP
    expect(patch.status(), `currency PATCH must succeed (got ${patch.status()})`).toBe(200)
    // The request body must include the new currency (proves it isn't dropped client-side).
    const reqBody = (() => {
      try {
        return JSON.parse(patch.request().postData() ?? '{}')
      } catch {
        return {}
      }
    })()
    expect(reqBody.currency, 'PATCH request body must carry the changed currency').toBe(probe)
    // The persisted response echoes the new currency (proves the API accepted it,
    // i.e. the validator did NOT strip the field).
    const patchBody = await patch.json().catch(() => null)
    const persistedCurrency = patchBody?.data?.currency ?? patchBody?.currency
    if (persistedCurrency != null) {
      expect(String(persistedCurrency), 'PATCH response must echo the new currency').toBe(probe)
    }

    // Durable read — reload the page; the Currency Select re-hydrates from the DB
    // and shows the changed currency, not the original.
    await gotoDuesConfig(page)
    await expect(currencyTrigger(page)).toContainText(probe, { timeout: 15000 })

    // Restore the original currency so the shared seed org is left unchanged.
    await dismissNpsIfPresent(page)
    await selectCurrency(page, original)
    const restoreP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await restoreP).status(), 'restore PATCH must succeed').toBe(200)
    await gotoDuesConfig(page)
    await expect(currencyTrigger(page)).toContainText(original, { timeout: 15000 })
  })

  test('Billing Frequency: change → save → reload → the selected frequency persists', async ({
    page,
  }) => {
    // Companion to the currency regression: billingFrequency is a real column on the
    // org-level dues_org_config table (the table the form reads back from) but was
    // ALSO omitted from the update payload + validator, so officer changes reverted on
    // reload. This proves the SELECTED billing frequency now survives a real save.
    await gotoDuesConfig(page)
    const input = amountInput(page)
    await expect(input).toBeVisible({ timeout: 15000 })

    // Billing Frequency is the SECOND combobox (after Currency).
    const billingTrigger = page.locator('button[role="combobox"]').nth(1)
    const originalFreq = ((await billingTrigger.textContent()) ?? '').trim()
    // Pick a different option than the current one. Labels: Annual / Semi-Annual / Quarterly.
    const isAnnual = /^annual$/i.test(originalFreq)
    const probeLabel = isAnnual ? /^semi-annual$/i : /^annual$/i
    const probeText = isAnnual ? 'Semi-Annual' : 'Annual'

    await dismissNpsIfPresent(page)
    await billingTrigger.click()
    await page.getByRole('option', { name: probeLabel }).click()
    await expect(billingTrigger).toContainText(probeText, { timeout: 5000 })

    const patchP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    const patch = await patchP
    expect(patch.status(), `billing-frequency PATCH must succeed (got ${patch.status()})`).toBe(200)
    // Request body must carry the changed billingFrequency (proves it isn't dropped).
    const reqBody = (() => {
      try {
        return JSON.parse(patch.request().postData() ?? '{}')
      } catch {
        return {}
      }
    })()
    expect(reqBody.billingFrequency, 'PATCH body must carry the changed billing frequency').toBe(
      probeText.toLowerCase(),
    )

    // Durable read — reload; the Billing Frequency Select re-hydrates from the DB.
    await gotoDuesConfig(page)
    await expect(page.locator('button[role="combobox"]').nth(1)).toContainText(probeText, {
      timeout: 15000,
    })

    // Restore the original billing frequency.
    await dismissNpsIfPresent(page)
    const restoreTrigger = page.locator('button[role="combobox"]').nth(1)
    await restoreTrigger.click()
    await page.getByRole('option', { name: new RegExp(`^${originalFreq}$`, 'i') }).click()
    const restoreP = page.waitForResponse(
      (r) => DUES_CONFIG_PATCH.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    expect((await restoreP).status(), 'restore PATCH must succeed').toBe(200)
    await gotoDuesConfig(page)
    await expect(page.locator('button[role="combobox"]').nth(1)).toContainText(originalFreq, {
      timeout: 15000,
    })
  })
})
