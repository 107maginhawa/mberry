// @selector-only-ok: visual regression baselines — pixel-diff snapshots, no data-flow assertions
/**
 * Visual regression baselines — Playwright `toHaveScreenshot` per key route.
 *
 * Workflow:
 *   - First run: writes baseline screenshots into __screenshots__/.
 *     Commit those — they're the gold reference.
 *   - Subsequent runs: diffs against baseline. Pixel diff above
 *     `expect.toHaveScreenshot.maxDiffPixelRatio` (0.02 = 2%) fails the test.
 *   - Intentional UI change: run `bunx playwright test _visual --update-snapshots`
 *     and commit the new baselines in the same PR as the change.
 *
 * Animations + cursors are disabled by default for stable diffs (Playwright
 * applies `animations: 'disabled'` per spec config).
 *
 * Skipped if SKIP_VISUAL=1 (e.g. on flaky-CI nights).
 */

import { test, expect } from './helpers/test-fixture'

if (process.env['SKIP_VISUAL']) {
  test.skip(true, 'SKIP_VISUAL=1 set — visual regression suite bypassed')
}

const ORG_ID = process.env['SEED_ORG_ID'] ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'

const PUBLIC_VIEWS = [
  { route: '/auth/sign-in', label: 'auth-sign-in' },
  { route: '/auth/sign-up', label: 'auth-sign-up' },
] as const

const MEMBER_VIEWS = [
  { route: '/dashboard', label: 'member-dashboard' },
  { route: `/org/${ORG_ID}/home`, label: 'member-org-home' },
  { route: `/org/${ORG_ID}/dues`, label: 'member-dues' },
  { route: `/org/${ORG_ID}/events`, label: 'member-events' },
  { route: `/org/${ORG_ID}/training`, label: 'member-training' },
  { route: `/org/${ORG_ID}/directory`, label: 'member-directory' },
] as const

const OFFICER_VIEWS = [
  { route: `/org/${ORG_ID}/officer/dashboard`, label: 'officer-dashboard' },
  { route: `/org/${ORG_ID}/officer/members`, label: 'officer-members' },
  { route: `/org/${ORG_ID}/officer/events`, label: 'officer-events' },
] as const

async function snapshot(page: import('@playwright/test').Page, route: string, label: string) {
  await page.goto(route)
  // Wait for at least one visible non-loading element before snapshot — avoids
  // diffing the skeleton screen.
  await page.waitForSelector('main, [role="main"], h1', { timeout: 10000 }).catch(() => {})
  await expect(page).toHaveScreenshot(`${label}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  })
}

test.describe('visual — public', () => {
  for (const { route, label } of PUBLIC_VIEWS) {
    test(label, async ({ page }) => snapshot(page, route, label))
  }
})

test.describe('visual — member', () => {
  test.use({ authRole: 'member' })
  for (const { route, label } of MEMBER_VIEWS) {
    test(label, async ({ page }) => snapshot(page, route, label))
  }
})

test.describe('visual — officer', () => {
  test.use({ authRole: 'officer' })
  for (const { route, label } of OFFICER_VIEWS) {
    test(label, async ({ page }) => snapshot(page, route, label))
  }
})
