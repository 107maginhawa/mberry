import { test, expect } from '@playwright/test'

/**
 * E2E: console operator flow — sign-in → dashboard (org list + revenue tile) → create org.
 *
 * All API calls are stubbed via page.route so this spec only needs the app
 * dev/preview server on :3006 — no live API, no Postgres, no seed required.
 *
 * Stub shapes match REAL handler responses (verified against use-session.ts,
 * use-orgs.ts, use-platform-stats.ts, use-associations.ts, use-create-org.ts,
 * CreateOrgView.tsx, OrgsView.tsx, sign-in.ts, lib/api.ts).
 *
 * Key shapes:
 *   - GET /admin/organizations: dual-purpose endpoint.
 *     useSession probe (401 pre-login → status='unauthed'; 200 post-login → status='authed').
 *     useOrgs data: { data: OrgRow[], pagination: { offset, limit, total } }.
 *     DRIFT: handler sends pagination.total; SDK type declares totalCount → cast.
 *   - GET /admin/national/platform: getPlatformSummary
 *     { data: [...], meta: { cursor, hasMore, total } }
 *     totalRevenueCents is a plain number (centavos); centavosToPhp(150000) = '₱1,500.00'.
 *   - GET /admin/associations: listAssociations
 *     { data: [...], pagination: { offset, limit, total } }
 *     DRIFT: handler sends pagination; SDK type declares count → cast.
 *     One item ensures noAssociations=false → submit button enabled.
 *   - POST /admin/organizations: createOrganization → 201 flat org (no data wrapper).
 *   - POST /auth/sign-in/email: Better-Auth sign-in (CSRF-exempt; sets httpOnly session cookie).
 *   - GET /csrf-token: CSRF interceptor (lib/api.ts fetches before non-CSRF-exempt SDK calls).
 */
test('operator signs in, sees dashboard with revenue tile, creates an organisation', async ({ page }) => {
  // Stateful flag: session probe returns 401 until sign-in succeeds.
  let signedIn = false

  // ── Stubs ────────────────────────────────────────────────────────────────────

  // CSRF token — fetched lazily by lib/api.ts interceptor before non-CSRF-exempt mutations.
  await page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'test' }) }),
  )

  // Better-Auth sign-in (CSRF-allowlisted; does NOT go through SDK).
  await page.route('**/auth/sign-in/email', (r) => {
    signedIn = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  // GET/POST /admin/organizations — shared route for session probe, org list, and create org.
  //   GET 401 (pre-login)  → useSession status='unauthed' → __root redirects to /sign-in.
  //   GET 200 (post-login) → useSession status='authed'  → __root renders route tree.
  //   POST 201             → createOrganization → flat org (createOrganizationResponseTransformer converts dates).
  // Trailing ** covers query strings (?limit=1 for probe, ?limit=100 for useOrgs).
  await page.route('**/admin/organizations**', (r) => {
    if (r.request().method() === 'POST') {
      // DRIFT: handler returns a flat org (no data wrapper).
      r.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'org-1',
          associationId: 'a1',
          name: 'New Chapter',
          orgType: 'chapter',
          status: 'trial',
          createdAt: '2026-06-27T00:00:00.000Z',
          updatedAt: '2026-06-27T00:00:00.000Z',
        }),
      })
      return
    }
    // GET — stateful auth probe + org list used by useSession and useOrgs.
    if (signedIn) {
      r.fulfill({
        contentType: 'application/json',
        // DRIFT: handler sends pagination {offset,limit,total}; SDK type declares totalCount → cast.
        body: JSON.stringify({
          data: [
            {
              id: 'o1',
              name: 'Olive Dental Chapter',
              region: 'NCR',
              orgType: 'chapter',
              status: 'trial',
              createdAt: '2026-06-01T00:00:00Z',
            },
          ],
          pagination: { offset: 0, limit: 100, total: 1 },
        }),
      })
    } else {
      r.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      })
    }
  })

  // GET /admin/national/platform → getPlatformSummary
  // totalRevenueCents:150000 centavos → centavosToPhp(Number(150000)) = '₱1,500.00'.
  // data.length > 0 → hasSnapshot=true → revenue tile renders (not EMDASH).
  // Trailing ** covers any query string params the SDK may append.
  await page.route('**/admin/national/platform**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            associationId: 'a1',
            chapterCount: 1,
            totalMembers: 5,
            activeMembers: 4,
            collectionRate: 80,
            creditCompliance: 0,
            totalRevenueCents: 150000,
          },
        ],
        meta: { cursor: null, hasMore: false, total: 1 },
      }),
    }),
  )

  // GET /admin/associations → listAssociations
  // DRIFT: handler sends pagination {offset,limit,total}; SDK type declares count → cast.
  // One association → noAssociations=false → CreateOrgView submit button is enabled.
  // Trailing ** covers ?limit=100 appended by useAssociations queryFn.
  await page.route('**/admin/associations**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'a1', name: 'PDA National', orgType: 'association', status: 'active' }],
        pagination: { offset: 0, limit: 100, total: 1 },
      }),
    }),
  )

  // ── 1. Navigate to sign-in ─────────────────────────────────────────────────
  // useSession probe fires immediately: /admin/organizations returns 401 → unauthed.
  // __root guard detects unauthed state and either lands on /sign-in or stays there.
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: /operator sign in/i })).toBeVisible()

  // ── 2. Fill and submit the sign-in form ────────────────────────────────────
  await page.fill('#email', 'founder@memberry.ph')
  await page.fill('#password', 'dev-password')

  // Gate: button must be enabled (not busy) before submitting.
  const signInBtn = page.getByRole('button', { name: /^sign in$/i })
  await expect(signInBtn).toBeEnabled()
  await signInBtn.click()

  // sign-in/email stub sets signedIn=true; React-Query invalidates ['session'] →
  // useSession refetches /admin/organizations → now 200 → status='authed' →
  // sign-in.tsx useEffect calls navigate({ to: '/' }).
  await page.waitForURL('/')

  // ── 3. Assert dashboard content ───────────────────────────────────────────
  // Org name appears in the table (OrgsView <TableCell>).
  await expect(page.getByText('Olive Dental Chapter')).toBeVisible()
  // Revenue tile: centavosToPhp(Number(150000)) where hasSnapshot=true.
  // centavosToPhp = '₱' + (amount/100).toLocaleString('en-PH', {min/maxFractionDigits:2}).
  await expect(page.getByText('₱1,500.00')).toBeVisible()
  // Sanity: no NaN (guards against missing Number() wrap on totalRevenueCents string drift).
  await expect(page.locator('body')).not.toContainText('NaN')

  // ── 4. Navigate to create-org page ────────────────────────────────────────
  // OrgsView header button (aria-label="Create organization") calls onCreate()
  // which calls navigate({ to: '/orgs/new' }).
  await page.getByRole('button', { name: /create organization/i }).click()
  await page.waitForURL('/orgs/new')
  // CardTitle renders as <div> (not heading) — assert on the Name label unique to this form.
  await expect(page.getByText('Name *')).toBeVisible()

  // ── 5. Fill the create-org form ───────────────────────────────────────────
  // Name (id="name", required input).
  await page.fill('#name', 'New Chapter')

  // Association (Radix UI Select; SelectTrigger has id="association").
  // Click trigger to open portal, then click the option (role="option").
  await page.locator('#association').click()
  await page.getByRole('option', { name: 'PDA National' }).click()

  // orgType defaults to 'chapter' → no change needed.

  // Gate on actionability: submit button must be enabled before clicking.
  // Disabled when: pending=true OR noAssociations=true.
  // noAssociations = associations.length === 0 → false (stub returned 1 assoc) → enabled.
  const createBtn = page.getByRole('button', { name: /^create organization$/i })
  await expect(createBtn).toBeEnabled()
  await createBtn.click()

  // ── 6. Assert success: Sonner toast + redirect to / + no NaN ─────────────
  // CreateOrg.tsx: toast.success(`Organization "${org.name}" created`) fires before
  // navigate({ to: '/' }). Sonner persists the toast in the portal across navigation.
  await expect(page.getByText('Organization "New Chapter" created')).toBeVisible()
  await page.waitForURL('/')
  await expect(page.locator('body')).not.toContainText('NaN')
})
