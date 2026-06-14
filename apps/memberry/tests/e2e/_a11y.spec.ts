// @selector-only-ok: axe-core a11y audit — asserts WCAG violations, no data-flow capture
/**
 * Accessibility audit — axe-core scans of every routable page.
 *
 * Two violation thresholds:
 *   - serious + critical → hard fail (this spec exits non-zero)
 *   - moderate           → soft, logged but not failing (graduate to hard
 *                          fail once existing violations are remediated)
 *
 * Pages are scanned in two contexts:
 *   - Unauthenticated routes (/, /auth/sign-in, /join, /verify-email)
 *   - Member-authed routes (uses the storageState setup project)
 *
 * Officer/treasurer/secretary surfaces get their own scans below.
 *
 * Memberry-specific: WCAG 2.1 AA is the target (the dental association
 * domain has older users; serious/critical only is the floor while we
 * land color/contrast fixes).
 */

import { test, expect } from './helpers/test-fixture'
import AxeBuilder from '@axe-core/playwright'

const SERIOUS_OR_WORSE = ['serious', 'critical'] as const
const ORG_ID = process.env['SEED_ORG_ID'] ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Routes the axe scan visits. Add more as features land. The page must
// be the exact URL pathname; query-strings + hash are ignored.
const PUBLIC_ROUTES = [
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
] as const

const MEMBER_ROUTES = [
  '/dashboard',
  `/org/${ORG_ID}/home`,
  `/org/${ORG_ID}/dues`,
  `/org/${ORG_ID}/events`,
  `/org/${ORG_ID}/training`,
  `/org/${ORG_ID}/directory`,
  `/org/${ORG_ID}/my-cpd`,
] as const

const OFFICER_ROUTES = [
  `/org/${ORG_ID}/officer`,
  `/org/${ORG_ID}/officer/dashboard`,
  `/org/${ORG_ID}/officer/members`,
  `/org/${ORG_ID}/officer/events`,
  `/org/${ORG_ID}/officer/training`,
] as const

async function scan(page: import('@playwright/test').Page, route: string) {
  await page.goto(route)
  // Let any auth-driven redirect settle before scanning.
  await expect(page).toHaveURL(/.*/, { timeout: 5000 })
  // SPA's query/state rendering ticks need a beat — without this axe
  // sometimes scans a skeleton state with low-contrast placeholders
  // ("Could not load …" alert that appears before retry succeeds).
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter((v) => (SERIOUS_OR_WORSE as readonly string[]).includes(v.impact ?? ''))
  if (serious.length > 0) {
    const summary = serious.map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n')
    throw new Error(`axe found ${serious.length} serious+critical violation(s) on ${route}:\n${summary}`)
  }

  const moderate = results.violations.filter((v) => v.impact === 'moderate')
  if (moderate.length > 0) {
    // Log but don't fail. Promote to hard-fail once landed.
    // eslint-disable-next-line no-console
    console.log(`  [moderate] ${route}: ${moderate.length} violation(s)`)
  }
}

test.describe('a11y — public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public ${route}`, async ({ page }) => {
      await scan(page, route)
    })
  }
})

test.describe('a11y — member-authed routes', () => {
  test.use({ authRole: 'member' })
  for (const route of MEMBER_ROUTES) {
    test(`member ${route}`, async ({ page }) => {
      await scan(page, route)
    })
  }
})

test.describe('a11y — officer-authed routes', () => {
  test.use({ authRole: 'officer' })
  for (const route of OFFICER_ROUTES) {
    test(`officer ${route}`, async ({ page }) => {
      await scan(page, route)
    })
  }
})
