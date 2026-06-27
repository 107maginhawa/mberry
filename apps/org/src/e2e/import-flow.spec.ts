// apps/org/src/e2e/import-flow.spec.ts
import { test, expect } from '@playwright/test'

// Stub bodies MUST match real handler shapes:
//  - getMyMemberships: { data: [{ organizationId, orgName }], total }
//  - listMembershipTiers: { data: [{ id, name, code, annualFee, ... }], pagination }
//      annualFee REQUIRED — responseTransformer calls annualFee.toString(); omit → throws
//  - importRosterMembers: FLAT { imported, skipped, failed, errors }
//
// No sign-in needed: memberships stub always returns 200 (authed) + localStorage org seed.
test('officer imports a roster CSV and sees the summary', async ({ page }) => {
  // CRITICAL: import POST is a non-CSRF-exempt mutation → lib/api.ts fetches /csrf-token first.
  // Without this stub the interceptor throws and the POST never fires.
  await page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 't' }) }),
  )

  // Memberships: RootGate useSession + useOrgs both call getMyMemberships.
  // Always 200 → status='authed' → /import is reachable without sign-in.
  await page.route('**/persons/me/memberships', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ organizationId: 'org-1', orgName: 'Dental Chapter' }],
        total: 1,
      }),
    }),
  )

  // Tiers: annualFee is required (responseTransformer calls .toString() on it).
  await page.route('**/association/member/tiers**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 't1',
            name: 'Regular',
            code: 'REGULAR',
            annualFee: '300000',
            currency: 'PHP',
            benefits: [],
            status: 'active',
          },
        ],
        pagination: {},
      }),
    }),
  )

  // Import endpoint: flat response (no data wrapper).
  await page.route('**/association/member/roster/import', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ imported: 2, skipped: 1, failed: 0, errors: [] }),
    }),
  )

  // Seed selectedOrgId so useSelectedOrg picks org-1 (matches memberships stub).
  await page.addInitScript(() => localStorage.setItem('org.selectedOrgId', 'org-1'))

  // ── 1. Navigate directly to /import (authed by memberships stub) ────────────
  await page.goto('/import')

  // ── 2. Select the tier ────────────────────────────────────────────────────
  // <select> is wrapped in <label> with span text "Membership tier"
  await page.getByLabel(/membership tier/i).selectOption('t1')

  // ── 3. Upload CSV (3 member rows) ─────────────────────────────────────────
  // File input: id="roster-file", label htmlFor="roster-file" text "Roster CSV file"
  await page.getByLabel(/roster csv/i).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('firstName,email\nOlive,olive@x.ph\nMaria,maria@x.ph\nJose,jose@x.ph'),
  })

  // ── 4. Preview: 3 members found ───────────────────────────────────────────
  // Component: `{parsed.stats.total} member{total===1?'':'s'} found`
  await expect(page.getByText(/3 members found/i)).toBeVisible()

  // ── 5. Submit import ──────────────────────────────────────────────────────
  // Button text: `Import ${rowCount} members` (template literal with .replace(/\s+/g,' ').trim())
  await page.getByRole('button', { name: /import 3 members/i }).click()

  // ── 6. Result summary ────────────────────────────────────────────────────
  // Component: "✓ {imported} new member{s} added"
  // Component: "↺ {skipped} already a member (skipped)"  ← singular for skipped=1
  await expect(page.getByText(/2 new members added/i)).toBeVisible()
  await expect(page.getByText(/1 already a member/i)).toBeVisible()
})
