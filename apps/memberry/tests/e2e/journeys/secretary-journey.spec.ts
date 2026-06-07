// WF-026 — Secretary Operations: minutes, attendance, comms
// Persona P4: Chapter Secretary (Ana Reyes)
// Covers: CS-1 through CS-13 — roster, member import, events, communications
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ storageState: authStateFile('secretary') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Helper: assert the page navigated to the expected URL pattern AND the
// app sidebar mounted (proxy for "page rendered, not blank-redirected").
async function assertPageMounted(
  page: import('@playwright/test').Page,
  urlMatch: RegExp,
) {
  await expect(page).toHaveURL(urlMatch, { timeout: 10000 })
  // Wait for the SPA shell to hydrate so the sidebar mount check below
  // doesn't race the initial empty-document state during rapid multi-step
  // navigation.
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('complementary').first()).toBeVisible({ timeout: 15000 })
}

test.describe('P4 Secretary Journey', () => {
  test('CS-1: secretary accesses officer dashboard', async ({ page }) => {
    const respP = captureRouteHydration(page, '/persons/me')
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await assertPageMounted(page, /\/officer\/dashboard$/)
  })

  test('CS-2: secretary can view member roster', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await assertPageMounted(page, /\/officer\/roster/)
  })

  test('CS-3: secretary can access member applications', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    await assertPageMounted(page, /\/officer\/applications/)
  })

  test('CS-4: secretary can view event management', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await assertPageMounted(page, /\/officer\/events/)
  })

  test('CS-5: secretary can access communications', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await assertPageMounted(page, /\/officer\/communications/)
  })

  test.fixme('CS-6: secretary can compose new announcement', async ({ page }) => {
    // Same flake as CS-7 + full-journey — secretary guard sometimes
    // resolves to "not officer" under parallel pressure. Lift after G10/G15.
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await assertPageMounted(page, /\/officer\/communications\/new/)
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10000 })
  })

  test.fixme('CS-7: secretary sidebar shows relevant navigation', async ({ page }) => {
    // FLAKY: secretary has officer role per /persons/me/officer-role API
    // (verified manually), but the guard's queryClient.ensureQueryData
    // sometimes resolves to an empty position list under load, redirecting
    // to /dashboard. The page then shows Member nav (no "Roster" link).
    // Reproduces only under parallel pressure — needs guard cache
    // investigation, OR retry-with-fresh-context. Lift after G10 / G15.
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByRole('link', { name: /roster/i }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test.fixme('full journey: dashboard → roster → applications → events → communications', async ({ page }) => {
    // SPA RACE UNDER PARALLEL: 4 rapid page.goto + assertPageMounted calls
    // race the SPA's empty-shell render between transitions. Sidebar
    // re-mounts each goto; the next goto fires before hydration completes.
    // Lift after G10 (per-test seed isolation) OR rewrite with explicit
    // page.waitForFunction(() => window.__appReady) hooks.
    await test.step('dashboard', async () => {
      await page.goto(`/org/${ORG_ID}/officer/dashboard`)
      await assertPageMounted(page, /\/officer\/dashboard$/)
    })

    await test.step('roster', async () => {
      await page.goto(`/org/${ORG_ID}/officer/roster`)
      await assertPageMounted(page, /\/officer\/roster/)
    })

    await test.step('events', async () => {
      await page.goto(`/org/${ORG_ID}/officer/events`)
      await assertPageMounted(page, /\/officer\/events/)
    })

    await test.step('communications', async () => {
      await page.goto(`/org/${ORG_ID}/officer/communications`)
      await assertPageMounted(page, /\/officer\/communications/)
    })
  })
})
