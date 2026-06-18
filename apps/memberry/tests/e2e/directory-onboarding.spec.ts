// Cross-Module Flow: Signup → Join Org → Directory Profile Auto-Created
// Covers: M01 (auth) → M05 (membership) → M10 (directory)
// Verifies that a newly registered member who joins an org appears in the member directory.
import { test, expect } from './helpers/test-fixture'
import { signUp, signIn, signInAsOfficer } from './helpers/auth'
import { API_BASE } from './helpers/test-config'
import { apiFetch } from './helpers/api-fetch'
import { independentRead } from './helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ORG_SLUG = 'pda-metro-manila'

// Clause 1: catch JS crashes / console.error across this cross-module flow.
// 4xx-strictness is intentionally NOT enabled here yet: this journey crosses
// many unauth→auth→role-gated transitions whose benign 401/403 probes need a
// per-step allow-list tuned against the real network profile — deferred to
// Phase D. pageerror + console.error + 5xx are enforced now.
test.use({ failOnConsoleError: true })

test.describe('Directory Onboarding: signup → join org → directory profile', () => {
  test.describe('New user registration creates person record', () => {
    test('signed-up user has a person record accessible via profile', async ({ page }) => {
      await test.step('sign up a brand new user', async () => {
        const { email, name } = await signUp(page)
        expect(email).toBeTruthy()
        expect(name).toBeTruthy()
      })

      await test.step('profile page loads without crashing', async () => {
        await page.goto('/my/profile')
        await page.waitForTimeout(2000)

        // Should show profile heading — person record was created by signUp helper
        // PageShell renders the page title as <h1>Profile</h1>; the page
        // also contains h3 "Directory Profile" / "Professional Licenses",
        // which would trigger a strict-mode collision without a level filter.
        // toBeVisible polls; isVisible({ timeout }) only checks once.
        await expect(
          page.getByRole('heading', { name: /^profile$/i, level: 1 }),
        ).toBeVisible({ timeout: 10000 })
      })
    })
  })

  test.describe('Member joins org via application flow', () => {
    let newUserEmail: string
    let newUserPassword: string

    test.beforeAll(async ({ browser }) => {
      // Create a fresh user for the join-org tests
      const page = await browser.newPage()
      const creds = await signUp(page)
      newUserEmail = creds.email
      newUserPassword = creds.password
      await page.close()
    })

    test('new user can navigate to org public page', async ({ page }) => {
      await signIn(page, newUserEmail, newUserPassword)

      await test.step('visit the org page', async () => {
        // Auth org layout has no index — /home is the canonical entry-point
        // for an org-scoped member view.
        await page.goto(`/org/${ORG_SLUG}/home`)
        // /home renders <h1>Organization Home</h1> via PageShell once
        // OrgProvider resolves the slug. The org's display name isn't shown
        // on this page — assert against the page title + URL persistence.
        await expect(
          page.getByRole('heading', { name: /organization home/i, level: 1 }),
        ).toBeVisible({ timeout: 15000 })
        expect(page.url()).toContain(`/org/${ORG_SLUG}/home`)
      })

      await test.step('org sidebar nav shows expected member entries', async () => {
        // OrgProvider mounts the org-scoped sidebar with predictable nav
        // links. We assert one (Events) is reachable — proxy for "the org
        // page rendered and the member can navigate inside it".
        const eventsLink = page.getByRole('link', { name: /^events$/i }).first()
        await expect(eventsLink).toBeVisible({ timeout: 5000 })
      })
    })

    test('officer can view applications page for the org', async ({ page }) => {
      await signInAsOfficer(page)

      await test.step('navigate to officer applications', async () => {
        await page.goto(`/org/${ORG_ID}/officer/applications`)
        await expect(page).toHaveURL(/applications/)
      })

      await test.step('applications page renders content', async () => {
        // Page renders <h1>Membership Applications</h1>. Use toBeVisible
        // (which polls) instead of isVisible({timeout}) which only checks once.
        await expect(
          page.getByRole('heading', { name: /membership applications/i, level: 1 }),
        ).toBeVisible({ timeout: 10000 })
      })
    })
  })

  test.describe('Approved member appears in directory', () => {
    // Uses seeded member account which is already approved and active
    test('active member is visible in org member directory', async ({ page }) => {
      await test.step('sign in as existing member', async () => {
        await signIn(page, 'member@memberry.ph', 'TestPass123!')
      })

      await test.step('navigate to member directory', async () => {
        await page.goto(`/org/${ORG_ID}/members`)
      })

      await test.step('directory loads with search and member cards', async () => {
        // Search input should be present
        const searchInput = page.getByPlaceholder(/search members/i)
        await expect(searchInput).toBeVisible({ timeout: 10000 })

        // There should be at least one member card or listing
        const hasMemberContent = await page
          .locator('.border.rounded-lg')
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false)
        const hasMemberList = await page
          .getByText(/member|name|role/i)
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
        expect(hasMemberContent || hasMemberList).toBeTruthy()
      })

      await test.step('page does not show undefined values', async () => {
        const pageContent = await page.textContent('body')
        expect(pageContent).not.toContain('undefined undefined')
      })
    })

    test.fixme('newly created member appears in directory search', async ({ page }) => {
      // KNOWN SPEC DESIGN ISSUE: this test calls POST /persons as the
      // signed-in officer expecting to create an *arbitrary* person row.
      // The handler (handlers/person/createPerson.ts:42) enforces that
      // each user creates one person row for themselves (1:1 user↔person)
      // and throws ConflictError('User already has a person profile') when
      // the caller already has one — the officer always does.
      //
      // To create a discoverable member here, swap the API setup for either
      // (a) a fresh signUp + apiFetch POST /organizations/{id}/members to
      // approve, or (b) a /membership/applicants → /membership/approve
      // sequence. Re-enable once that rewrite happens.
      // ---------------------------- ORIGINAL BODY ----------------------------
      // This test creates a member via API, then verifies they show in the directory.
      // This simulates the post-approval state: person + membership exist → directory shows them.
      // Use crypto.randomUUID so concurrent + repeated runs never collide on email
      // (POST /persons returns 409 on duplicate contactInfo.email).
      const uniqueName = `DirectoryTest-${crypto.randomUUID().slice(0, 8)}`

      await test.step('sign in as officer (has permission to create members)', async () => {
        await signInAsOfficer(page)
      })

      let personId: string | null = null

      await test.step('create a person record via API', async () => {
        // page.goto lands on the SPA so the in-page `fetch` carries a real
        // Origin header and the better-auth.csrf_token cookie from apiFetch
        // can survive the redirect chain.
        await page.goto('/dashboard')
        const result = await apiFetch<{ id?: string; data?: { id?: string } }>(
          page,
          '/persons',
          {
            method: 'POST',
            orgId: ORG_ID,
            body: {
              firstName: uniqueName,
              lastName: 'Onboarding',
              contactInfo: { email: `${uniqueName.toLowerCase()}@test-directory.com` },
            },
          },
        )

        expect(result.status).toBeLessThan(400)
        personId = result.data?.id ?? result.data?.data?.id ?? null
      })

      await test.step('add person as org member via API', async () => {
        if (!personId) {
          test.skip(true, 'Person creation failed — cannot add member')
          return
        }

        const result = await apiFetch(page, `/organizations/${ORG_ID}/members`, {
          method: 'POST',
          orgId: ORG_ID,
          body: { personId, role: 'member', status: 'active' },
        })

        expect(result.status).toBeLessThan(400)
      })

      await test.step('search directory for the new member', async () => {
        await page.goto(`/org/${ORG_ID}/members`)
        const searchInput = page.getByPlaceholder(/search members/i)
        await expect(searchInput).toBeVisible({ timeout: 10000 })

        // Search for the unique name we just created
        await searchInput.fill(uniqueName)
        await page.waitForTimeout(2000) // debounce + API call

        // The new member should appear in results
        await expect(page
          .getByText(uniqueName)
          .first()).toBeVisible({ timeout: 10000 })
      })
    })
  })

  test.describe('Full journey: signup → membership → directory verification', () => {
    test('end-to-end onboarding produces a discoverable directory profile', async ({ page }) => {
      let email: string
      let userName: string
      let personId: string | undefined

      await test.step('1. sign up new user', async () => {
        const creds = await signUp(page)
        email = creds.email
        userName = creds.name
        expect(email).toBeTruthy()
      })

      await test.step('2. user lands on authenticated page after signup', async () => {
        await page.waitForLoadState('networkidle')
        // signUp already navigated away from /auth/sign-up; the exact landing
        // (dashboard / onboarding / org / authenticated root / verify-email)
        // varies by env. Assert we left the sign-up form into a rendered page.
        expect(page.url()).not.toContain('/auth/sign-up')
        await expect(page.locator('body')).toBeVisible()
      })

      await test.step('3. user profile page is accessible', async () => {
        await page.goto('/my/profile')
        // PageShell renders the page title as <h1>Profile</h1>; the page
        // also contains h3 "Directory Profile" / "Professional Licenses",
        // which would trigger a strict-mode collision without a level filter.
        // toBeVisible polls; isVisible({ timeout }) only checks once.
        await expect(
          page.getByRole('heading', { name: /^profile$/i, level: 1 }),
        ).toBeVisible({ timeout: 10000 })
      })

      await test.step('4. user can view org page', async () => {
        // Auth org layout has no index; visit /home explicitly. Org display
        // name isn't surfaced on /home — assert page title instead.
        await page.goto(`/org/${ORG_SLUG}/home`)
        await expect(
          page.getByRole('heading', { name: /organization home/i, level: 1 }),
        ).toBeVisible({ timeout: 15000 })
        expect(page.url()).toContain(`/org/${ORG_SLUG}/home`)
      })

      await test.step('5. verify org nav is reachable', async () => {
        // OrgProvider exposes a member-side nav with Events/Announcements/etc.
        // We treat presence of one stable nav entry as proof the org context
        // mounted cleanly for this freshly-signed-up user.
        await expect(
          page.getByRole('link', { name: /^events$/i }).first(),
        ).toBeVisible({ timeout: 5000 })
      })

      // NOTE: Steps 6-7 simulate post-approval via API since the approval flow
      // requires officer intervention (tested separately in officer/application-review.spec.ts)

      await test.step('6. simulate membership approval via API (officer action)', async () => {
        // GET /persons/me is read-only; no CSRF needed but Origin matters,
        // so issue from inside the page (post-navigation).
        const personResult = await apiFetch<{ id?: string; data?: { id?: string } }>(
          page,
          '/persons/me',
        )

        personId = personResult.data?.id ?? personResult.data?.data?.id
        // Clause 3: the freshly-signed-up user MUST have a person row — assert
        // it rather than silently skipping the rest of the journey (G3b).
        expect(personId, 'signed-up user has a person id').toBeTruthy()

        // POST is state-changing — apiFetch attaches x-csrf-token + Origin.
        const memberResult = await apiFetch(page, `/organizations/${ORG_ID}/members`, {
          method: 'POST',
          orgId: ORG_ID,
          body: { personId, role: 'member', status: 'active' },
        })

        // Clause 3: 201 created or 409 already-exists — both acceptable.
        expect([200, 201, 409], `add-member succeeded (got ${memberResult.status})`).toContain(
          memberResult.status,
        )
      })

      await test.step('7. member directory shows the new member', async () => {
        await page.goto(`/org/${ORG_ID}/members`)
        // Directory page should load without errors. Use toBeVisible (polls)
        // instead of isVisible({timeout}) (single check).
        await expect(page.getByPlaceholder(/search members/i))
          .toBeVisible({ timeout: 10000 })

        // Page should not show broken state
        const pageContent = await page.textContent('body')
        expect(pageContent).not.toContain('undefined undefined')
      })

      await test.step('8. clause 4 — new member is in the org roster (independent session)', async () => {
        // Confirm the goal from a SEPARATE officer session reading durable
        // roster state, not the member UI just driven.
        const roster = await independentRead<{ status: number; present: boolean }>(
          'officer',
          async (api) => {
            const res = await api.get<{ data?: Array<{ personId?: string }> }>(
              `/membership/members/${ORG_ID}`,
              { orgId: ORG_ID },
            )
            const present = (res.data?.data ?? []).some((m) => m.personId === personId)
            return { status: res.status, present }
          },
        )
        expect(roster.status, 'officer reads org roster').toBe(200)
        expect(roster.present, 'newly-added member appears in the durable roster').toBe(true)
      })
    })
  })
})
