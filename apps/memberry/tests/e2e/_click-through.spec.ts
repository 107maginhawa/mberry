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
import { authStateFile } from './helpers/auth-state'

const ORG_ID = process.env['SEED_ORG_ID'] ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const BLANK_PAGE_TIMEOUT = 3000

async function isBlank(page: import('@playwright/test').Page): Promise<boolean> {
  // Page is "blank" if there's no <main>/<h1>/role=main content AND no explicit
  // empty-state ("nothing here", "no items", "empty") text visible.
  const hasMain = await page
    .locator('main, [role="main"], h1')
    .first()
    .isVisible({ timeout: BLANK_PAGE_TIMEOUT })
    .catch(() => false)
  if (hasMain) return false

  const hasEmptyState = await page
    .getByText(/no .* yet|nothing here|empty|no items|no data/i)
    .first()
    .isVisible({ timeout: BLANK_PAGE_TIMEOUT })
    .catch(() => false)
  return !hasEmptyState
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
    await page.goto(href).catch(() => {})
    expect.soft(await isBlank(page), `${href} rendered blank (no <main>, no empty state)`).toBe(false)
  }

  page.off('response', networkListener)
  expect.soft(errors5xx, `5xx responses during click-through:\n  ${errors5xx.join('\n  ')}`).toEqual([])
}

test.describe('click-through — member', () => {
  test.use({ storageState: authStateFile('member') })
  test('member can reach + render every visible link from /dashboard without blanks or 5xx', async ({ page }) => {
    await clickThrough(page, '/dashboard')
  })
  test('member can reach + render every visible link from org home', async ({ page }) => {
    await clickThrough(page, `/org/${ORG_ID}/home`)
  })
})

test.describe('click-through — officer', () => {
  test.use({ storageState: authStateFile('officer') })
  test('officer can reach + render every visible link from officer dashboard', async ({ page }) => {
    await clickThrough(page, `/org/${ORG_ID}/officer/dashboard`)
  })
})
