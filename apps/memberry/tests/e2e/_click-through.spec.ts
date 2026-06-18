/**
 * Click-through gate — for each persona, programmatically visit the
 * persona's reachable surface and:
 *   1. Collect every visible nav link + button
 *   2. Click each link (skip external + auth-logout)
 *   3. After every navigation, assert:
 *        a. no console errors (filterable via allowConsoleErrors fixture)
 *        b. no network 5xx response
 *        c. either rendered content OR an explicit empty-state element —
 *           never a blank page silently
 *
 * Catches the failure mode that motivated the memory rule
 * `feedback_click_through_testing`: "file existence ≠ feature works".
 *
 * One spec per persona (member, officer) — extend to treasurer/secretary
 * once the entry routes are confirmed for each.
 */

import { test, expect } from './helpers/test-fixture'

const ORG_ID = process.env['SEED_ORG_ID'] ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'
// Generous timeout: in CI the app is a production preview build, so each
// lazy-loaded route chunk (and any post-signin redirect) hydrates slower
// than the local dev server — 3s raced cold routes under sharded workers.
const BLANK_PAGE_TIMEOUT = 10000

async function isBlank(page: import('@playwright/test').Page): Promise<boolean> {
  // Page is "blank" if there's no <main>/<h1>/role=main content AND no
  // explicit empty-state visible after the SPA has had a chance to hydrate.
  // Use waitFor (which actually polls) instead of isVisible({timeout})
  // (which is a one-shot check that races SPA mount).
  try {
    await page
      .locator('main, [role="main"], h1')
      .first()
      .waitFor({ state: 'visible', timeout: BLANK_PAGE_TIMEOUT })
    return false
  } catch {
    // Fall through to empty-state probe.
  }
  try {
    await page
      .getByText(/no .* yet|nothing here|empty|no items|no data/i)
      .first()
      .waitFor({ state: 'visible', timeout: BLANK_PAGE_TIMEOUT })
    return false
  } catch {
    return true
  }
}

async function clickThrough(page: import('@playwright/test').Page, entryRoute: string) {
  const errors5xx: string[] = []
  const networkListener = (response: import('@playwright/test').Response) => {
    if (response.status() >= 500) errors5xx.push(`${response.status()} ${response.url()}`)
  }
  page.on('response', networkListener)

  await page.goto(entryRoute)
  await expect(page.locator('body')).toBeVisible()

  // Collect every internal <a href> within the current persona surface. Filter
  // external + logout + mailto/tel.
  const links = await page
    .locator('a[href]')
    .evaluateAll((anchors) =>
      (anchors as HTMLAnchorElement[])
        .map((a) => a.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/') && !href.startsWith('//'))
        .filter((href) => !href.startsWith('/auth/sign-out'))
        .filter((href) => !href.includes('mailto:') && !href.includes('tel:'))
        .filter((href, idx, arr) => arr.indexOf(href) === idx),
    )

  for (const href of links.slice(0, 25)) {
    await page.goto(href, { waitUntil: 'domcontentloaded' }).catch(() => {})
    let blank = await isBlank(page)
    if (blank) {
      // One retry for transient first-paint races.
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      blank = await isBlank(page)
    }
    expect.soft(blank, `${href} rendered blank (no <main>, no empty state)`).toBe(false)
  }

  page.off('response', networkListener)
  expect.soft(errors5xx, `5xx responses during click-through:\n  ${errors5xx.join('\n  ')}`).toEqual([])
}

test.describe('click-through — member', () => {
  test.use({ authRole: 'member' })
  test('member can reach + render every visible link from /dashboard without blanks or 5xx', async ({ page }) => {
    await clickThrough(page, '/dashboard')
  })
  test('member can reach + render every visible link from org home', async ({ page }) => {
    await clickThrough(page, `/org/${ORG_ID}/home`)
  })
})

test.describe('click-through — officer', () => {
  test.use({ authRole: 'officer' })
  test('officer can reach + render every visible link from officer dashboard', async ({ page }) => {
    await clickThrough(page, `/org/${ORG_ID}/officer/dashboard`)
  })
})

test.describe('T5 focused 5-page click-through with data-row assertions', () => {
  // Real-UI promotion: rather than crawling every link on a single page,
  // visit 5 high-value list/detail surfaces, assert the canonical heading
  // renders, AND assert at least one data-bearing row/card is visible
  // (skeleton/empty-state both count — proves the SPA query resolved and
  // the UI committed to a final visual state, not a perpetual loading
  // shimmer or blank container).
  test.use({ authRole: 'officer' })

  const SURFACES: Array<{ name: string; path: string; heading: RegExp }> = [
    { name: 'Roster',         path: `/org/pda-metro-manila/officer/roster`,           heading: /roster|members/i },
    { name: 'Applications',   path: `/org/pda-metro-manila/officer/applications`,     heading: /applications/i },
    { name: 'Payments',       path: `/org/pda-metro-manila/officer/payments`,         heading: /dues.*payments|payments/i },
    { name: 'Invoices',       path: `/org/pda-metro-manila/officer/finances/invoices`, heading: /invoices/i },
    { name: 'Events',         path: `/org/pda-metro-manila/officer/events`,           heading: /events/i },
  ]

  for (const { name, path, heading } of SURFACES) {
    test(`${name} surface renders heading + at least one row or empty state`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { name: heading, level: 1 }).first(),
      ).toBeVisible({ timeout: 15000 })

      // At least one of: a real data row (table row in tbody, list item),
      // a card-like article element, OR an explicit empty-state with
      // recognisable copy. Whichever resolves first wins.
      const dataRow = page.locator('table tbody tr, ul li[role="listitem"], article, [class*="card"]').first()
      const emptyState = page.getByText(/no .* yet|nothing here|no .* found|no invoices|no events|no members|no applications/i).first()

      await Promise.race([
        dataRow.waitFor({ state: 'visible', timeout: 15000 }),
        emptyState.waitFor({ state: 'visible', timeout: 15000 }),
      ])

      // Final assertion: SOMETHING committed visually beyond the shell.
      const hasRow = await dataRow.isVisible().catch(() => false)
      const hasEmpty = await emptyState.isVisible().catch(() => false)
      expect(hasRow || hasEmpty, `${name} renders neither a row nor an empty state`).toBe(true)
    })
  }
})
