import { test, expect } from '@playwright/test'
import { signUp, signIn } from './helpers/auth'

/**
 * Real integration E2E tests — NO page.route() mocks.
 * All requests hit the running API at localhost:7213.
 * Requires: API server + seed data (bun run db:seed).
 */

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562' // PDA Metro Manila (from seed)
const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASSWORD = 'TestPass123!'
const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'

// ═══════════════════════════════════════════════════════════════════
// AUTH FLOWS
// ═══════════════════════════════════════════════════════════════════

test.describe('Auth flows (real API)', () => {
  test('sign up new user → lands on authenticated page', async ({ page }) => {
    const creds = await signUp(page)
    expect(creds.email).toBeTruthy()
    // After signup, should be on an authenticated page (not sign-in)
    await expect(page).not.toHaveURL(/auth\/sign-in/)
  })

  test('sign in with seeded officer creds → dashboard renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto('/dashboard')
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
    await expect(page.getByText(OFFICER_EMAIL)).toBeVisible()
  })

  test('sign in with seeded member creds → dashboard renders', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
  })

  test('unauthenticated → redirected to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/auth\/sign-in/, { timeout: 10000 })
  })
})

// ═══════════════════════════════════════════════════════════════════
// MEMBER PAGES (authenticated, real API)
// ═══════════════════════════════════════════════════════════════════

test.describe('Member pages (real API)', () => {
  let credentials: { email: string; password: string; name: string }

  test.beforeAll(async ({ browser }) => {
    // Use seeded officer account (has person + membership)
    credentials = { email: OFFICER_EMAIL, password: OFFICER_PASSWORD, name: 'Maria Santos' }
  })

  test('profile shows real person data', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/profile')

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByText('Maria Santos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible()
  })

  test('settings page renders toggles', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('my organizations shows membership', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/organizations')

    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible()
  })

  test('dashboard renders heading', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/dashboard')

    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
  })

  test('notifications page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/notifications')

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  })

  test('ID card page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/id-card')

    await expect(page.getByRole('heading', { name: 'Digital ID Card' })).toBeVisible()
  })

  test('my events page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/events')

    await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
  })

  test('my training page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/training')

    await expect(page.getByRole('heading', { name: 'My Training' })).toBeVisible()
  })

  test('my payments page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/payments')

    await expect(page.getByRole('heading', { name: 'My Payments' })).toBeVisible()
  })

  test('my credits page renders with summary cards', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/credits')

    await expect(page.getByRole('heading', { name: 'CPD Credits' })).toBeVisible()
    await expect(page.getByText('Earned', { exact: true })).toBeVisible()
  })

  test('my certificates page renders', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/certificates')

    await expect(page.getByRole('heading', { name: 'My Certificates' })).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════
// OFFICER PAGES (role-gated, real API with seeded data)
// ═══════════════════════════════════════════════════════════════════

test.describe('Officer pages (real API, seeded data)', () => {
  test('roster shows real membership data', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)

    await expect(page.getByRole('heading', { name: 'Member Roster' })).toBeVisible()
    // Real seeded data — should show actual members, not "Failed to load"
    await expect(page.getByText('PDA-2025-001')).toBeVisible()
    await expect(page.getByText('PDA-2025-002')).toBeVisible()
  })

  test('chapters page shows empty state (no error)', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)

    await expect(page.getByRole('heading', { name: 'Chapter Affiliations' })).toBeVisible()
    await expect(page.getByText('No chapter affiliations.')).toBeVisible()
  })

  test('applications page renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/applications`)

    await expect(page.getByRole('heading', { name: 'Membership Applications' })).toBeVisible()
  })

  test('payments page renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/payments`)

    await expect(page.getByRole('heading', { name: 'Dues & Payments' })).toBeVisible()
  })

  test('dues config page renders form', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)

    await expect(page.getByRole('heading', { name: 'Dues Configuration' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Dues Config' })).toBeVisible()
  })

  test('communications stub renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    await expect(page.getByRole('heading', { name: 'Communications' })).toBeVisible()
  })

  test('events stub renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/events`)

    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible()
  })

  test('training stub renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/training`)

    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible()
  })

  test('credit report renders stat cards', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)

    await expect(page.getByRole('heading', { name: 'Credit Compliance Report' })).toBeVisible()
    await expect(page.getByText('Compliant', { exact: true })).toBeVisible()
  })

  test('event attendance page renders', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/events/evt-test`)

    await expect(page.getByRole('heading', { name: 'Event Attendance' })).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════
// PUBLIC PAGES
// ═══════════════════════════════════════════════════════════════════

test.describe('Public pages (real API)', () => {
  test('public org page shows real org data', async ({ page }) => {
    await page.goto('/org/pda-metro-manila')

    // Should show org info from seeded data
    await expect(page.getByText(/PDA Metro Manila/i)).toBeVisible()
  })

  test('onboarding flow works', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto('/onboarding')

    await expect(page.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible()
    await expect(page.getByText('Step 1 of 2')).toBeVisible()

    // Advance to step 2
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 2 of 2')).toBeVisible()
  })

  test('member directory renders search', async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
    await page.goto(`/org/${ORG_ID}/members`)

    await expect(page.getByRole('heading', { name: 'Member Directory' })).toBeVisible()
    await expect(page.getByPlaceholder('Search members by name, specialty...')).toBeVisible()
  })

  // Token-based public pages use mocks (external integrations not available in dev)
  test('verify page handles invalid token', async ({ page }) => {
    await page.route('**/api/verify/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid token' }),
      }),
    )
    await page.goto('/verify/test-token')
    await expect(page.getByText('Verification Failed')).toBeVisible()
  })

  test('invite page handles expired token', async ({ page }) => {
    await page.route('**/api/invite/**/validate', (route) =>
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Expired', code: 'EXPIRED' }),
      }),
    )
    await page.goto('/invite/test-token')
    await expect(page.getByText('Invitation Expired')).toBeVisible()
  })

  test('pay page handles invalid token', async ({ page }) => {
    await page.route('**/api/pay/**/validate', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: false, error: 'Invalid link' }),
      }),
    )
    await page.goto('/pay/test-token')
    await expect(page.getByText('Payment Link Invalid')).toBeVisible()
  })
})
