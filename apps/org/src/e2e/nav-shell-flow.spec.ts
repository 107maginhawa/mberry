/**
 * E2E: nav shell (Slice 1) — the people-first 3-tab IA.
 *
 * Real user flow on the live app server (:3005), all API stubbed via page.route
 * (same auth-stub shape as officer-flow.spec.ts). Proves: every existing screen
 * stays reachable under the new shell, the right tab lights up, and More groups
 * the low-frequency tools. Asserts behaviour (URLs + visible tools + active
 * tab), not internal selectors.
 */
import { test, expect } from '@playwright/test'

test('officer navigates the 3-tab shell: Members ↔ Events ↔ More → a tool', async ({ page }) => {
  let signedIn = false

  await page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 't' }) }),
  )
  await page.route('**/auth/email-otp/send-verification-otp', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  )
  await page.route('**/auth/sign-in/email-otp', (r) => {
    signedIn = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Chapter A' }], total: 1 }),
        })
      : r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }),
  )
  await page.route('**/association/member/roster**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], totalCount: 0 }) }),
  )
  // Events list — empty is fine; the Events tab just has to render its screen.
  // Anchor to the API path (/association/events) — a bare **/events** glob also
  // hijacks Vite's dev module requests (/src/features/events/*) and blanks the app.
  await page.route('**/association/events**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], totalCount: 0 }) }),
  )

  // ── Sign in ──────────────────────────────────────────────────────────────
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('officer@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')

  // ── On Members (home): the shell is present and Members is active ─────────
  const membersTab = page.getByRole('link', { name: 'Members' })
  const eventsTab = page.getByRole('link', { name: 'Events' })
  const moreTab = page.getByRole('link', { name: 'More' })
  await expect(membersTab).toHaveAttribute('aria-current', 'page')
  await expect(eventsTab).not.toHaveAttribute('aria-current', 'page')

  // ── Events tab → /events, lights Events ──────────────────────────────────
  await eventsTab.click()
  await page.waitForURL('/events')
  await expect(eventsTab).toHaveAttribute('aria-current', 'page')

  // ── More tab → /more hub with the four low-frequency tools ────────────────
  await moreTab.click()
  await page.waitForURL('/more')
  await expect(moreTab).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: /import roster/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /dues/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /announcements/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /payment settings/i })).toBeVisible()

  // ── A More tool is reachable (Import) and keeps More lit ──────────────────
  await page.getByRole('link', { name: /import roster/i }).click()
  await page.waitForURL('/import')
  await expect(moreTab).toHaveAttribute('aria-current', 'page')

  // ── Back to Members ──────────────────────────────────────────────────────
  await membersTab.click()
  await page.waitForURL('/')
  await expect(membersTab).toHaveAttribute('aria-current', 'page')
})
