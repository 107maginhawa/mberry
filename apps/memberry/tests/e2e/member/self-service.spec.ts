// Matrix C member-facing routes: notification preferences, DM inbox, security
// settings. Each asserts the route hydrates real backend state (not just a
// heading). DM is REST-only — the realtime WebSocket layer is not asserted here.
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'member' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member self-service routes', () => {
  test('my-notifications hydrates real subscription preferences', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/person-subscriptions/)
    await page.goto(`/org/${ORG_ID}/my-notifications`)

    await expect(page.getByRole('heading', { name: /notification preferences/i })).toBeVisible({ timeout: 15000 })
    const resp = await respP
    expect(resp?.status(), 'person-subscriptions GET must succeed (me resolves to caller)').toBe(200)
    // The preference matrix renders one switch per category × channel.
    await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 10000 })
  })

  test('DM inbox hydrates the chat-room list', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/chat-rooms(\?|$)/)
    await page.goto(`/org/${ORG_ID}/messages/dm`)

    const resp = await respP
    expect(resp?.status(), 'chat-rooms GET must succeed').toBe(200)
    // Either existing DM threads render, or the empty conversation state — both
    // prove the list query resolved with real data.
    await expect(
      page.getByText(/select a conversation|no conversations|new message/i)
        .or(page.locator('a[href*="/messages/dm/"]'))
        .first(),
    ).toBeVisible({ timeout: 15000 })
  })

  // NOTE: the standalone /settings/security route renders the unauthenticated
  // "Welcome to Memberry" shell on hard-load (the security UI is only reachable
  // via the Security tab on /my/settings, already covered by settings.spec.ts).
  // Left uncovered as a route — flagged in the PHASE6 report.
})
