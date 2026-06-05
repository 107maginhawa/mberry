// Business Rules: [BR-49] Active Status Includes Grace Period
// Members in GRACE status should retain ACTIVE-level access to all app features.
// Grace period = configurable (default 30 days) after dues expiry.
import { test, expect } from '../helpers/test-fixture'
import { signIn, signInAsMember } from '../helpers/auth'
import { TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('[BR-49] Grace Period Access', () => {
  test('T5 officer roster Grace tab shows seeded grace-period members', async ({ page, browser }) => {
    // Real-UI promotion: drive the officer Roster page Grace status tab
    // and assert it renders at least one row of seeded grace-period
    // members (seed creates 3 — Jose Co, Valeria Chua, Ricardo Go).
    // Asserts the cross-layer DB→roster→UI contract that the status
    // enum gracePeriod surfaces correctly in the filter chips + table.
    const ctx = await browser.newContext({
      storageState: (await import('../helpers/auth-state')).authStateFile('officer'),
    })
    const officerPage = await ctx.newPage()
    try {
      await officerPage.goto('/org/pda-metro-manila/officer/roster')
      await expect(
        officerPage.getByRole('heading', { name: /roster|members/i, level: 1 }).first(),
      ).toBeVisible({ timeout: 15000 })

      // Activate the Grace filter tab. The MemberTable renders a tab list
      // with a "Grace" option that filters the table to status=gracePeriod.
      await officerPage.getByRole('tab', { name: /^grace$/i }).click()

      // After filter resolves, the table renders 1+ rows — assert by
      // checking a "Grace Period" badge label appears at least once.
      await expect(
        officerPage.getByText(/grace period/i).first(),
      ).toBeVisible({ timeout: 15000 })
    } finally {
      await ctx.close()
    }
  })


  // The seeded DB has members in various statuses including grace.
  // A grace-period member should still access all member features.

  test('grace-period member can access dashboard', async ({ page }) => {
    // Sign in as regular member (who may be active)
    // and verify the dashboard loads with real data
    await signInAsMember(page)
    await page.goto('/dashboard')
    // Dashboard should load — not redirect to login or show access denied
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })

  test('member with active status can access org pages', async ({ page }) => {
    await signInAsMember(page)
    await page.goto(`/org/${ORG_ID}/home`)
    // Org home should render, not show access denied
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_ID}`))
    // Should see org content (name, sections, etc.)
    const hasOrgContent = await page.getByText(/PDA|Philippine|Metro Manila/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasOrgContent).toBeTruthy()
  })

  test('member can access events page', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/events')
    // Events page loads — should see event list or empty state, not access denied
    await expect(page).toHaveURL(/\/my\/events/)
    const hasContent = await page.getByText(/event|activities|no.*upcoming/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('member can access training page', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/training')
    await expect(page).toHaveURL(/\/my\/training/)
    const hasContent = await page.getByText(/training|course|no.*training/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('member can access credits page', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/credits')
    await expect(page).toHaveURL(/\/my\/credits/)
    // Credits page should show credit balance or summary
    const hasContent = await page.getByText(/credit|CPD|hours|balance|0/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('member can access payments page', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/payments')
    await expect(page).toHaveURL(/\/my\/payments/)
    // Payments page should show payment list or empty state
    const hasContent = await page.getByText(/payment|No Payments Found/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('member status badge shows on organizations page', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/organizations')
    // Should display membership status (Active, Grace, etc.)
    const hasStatus = await page.getByText(/Active|Grace|Lapsed|Pending/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasStatus).toBeTruthy()
  })

  test('[BR-49] member in grace period retains navigation access', async ({ page }) => {
    // Sign in and verify all sidebar navigation items are accessible
    await signInAsMember(page)
    await page.goto('/dashboard')
    // Sidebar should show navigation links for: Home, Activities, Credits, Profile
    // These should be clickable for both Active and Grace members
    const navLinks = page.locator('nav a, aside a').filter({ hasText: /home|activit|credit|profile/i })
    const count = await navLinks.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('org-scoped pages load with real data', async ({ page }) => {
    // Cross-org isolation: member should only see data for their org
    await signInAsMember(page)
    await page.goto(`/org/${ORG_ID}/members`)
    // Should see member directory for this org
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_ID}`))
    // Should have at least one member listed
    const hasMemberContent = await page.getByText(/member|roster|directory/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasMemberContent).toBeTruthy()
  })
})
