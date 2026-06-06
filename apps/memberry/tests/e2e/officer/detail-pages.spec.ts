import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const FAKE_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Each officer detail route should render to a known state (heading,
 * not-found banner, or sidebar) when handed a non-existent ID — never
 * a blank screen. Use waitFor (polls) instead of isVisible({timeout})
 * which is a one-shot check.
 *
 * W2 real-flow upgrade: capture any API GET so we prove the shell
 * hydrated through at least one backend call before the detail lookup
 * 404s (the FAKE_ID won't resolve, but /persons/me + sidebar queries
 * still fire). The 404-on-detail itself is expected and surfaces via
 * the not-found banner that assertReachable already tolerates.
 */
async function assertReachable(page: import('@playwright/test').Page, route: string) {
  const respP = captureAnyApiSuccess(page)
  await page.goto(route)
  const resp = await respP
  expect(resp?.status()).toBeLessThan(400)
  expect(resp?.ok()).toBe(true)
  await expect(page.getByRole('complementary').first())
    .toBeVisible({ timeout: 10000 })
  // Either content (any heading) OR a not-found state must render.
  try {
    await page.locator('h1, h2, [role="heading"]').first()
      .waitFor({ state: 'visible', timeout: 5000 })
    return
  } catch { /* fall through */ }
  await expect(
    page
      .getByText(/not found|no data|does not exist|error|unable to load|failed to load/i)
      .first(),
  ).toBeVisible({ timeout: 5000 })
}

test.describe('Officer Detail Pages', () => {
  test('roster member detail page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/roster/${FAKE_ID}`)
  })

  test('event detail page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/events/${FAKE_ID}`)
  })

  test('election detail page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/elections/${FAKE_ID}`)
  })

  test('communication detail page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/communications/${FAKE_ID}`)
  })

  test('payment detail page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/payments/${FAKE_ID}`)
  })

  test('event attendance page loads', async ({ page }) => {
    await assertReachable(page, `/org/${ORG_ID}/officer/events/${FAKE_ID}/attendance`)
  })
})
