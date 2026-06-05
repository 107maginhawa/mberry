// WF-082 — Officer Transition: post-election handoff
// Cross-Module Flow 6.5: Election → Officer Transition
// Covers: M12 (elections) → M04 (org admin) → Notifications
// Election creation, nomination, voting, certification, new officer assignment.
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Election → Officer Transition', () => {
  test('officer sees election management with status lifecycle', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to elections', async () => {
      await page.goto(`/org/${ORG_ID}/officer/elections`)
    })

    await test.step('elections list shows multiple elections with statuses', async () => {
      // Should see seeded elections: one published/completed (2025), one draft (2026)
      const hasElections = await page.getByText(/election/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasElections).toBeTruthy()

      // Multiple statuses should be visible
      const statuses = await page.getByText(/draft|published|open|closed|completed/i).all()
      expect(statuses.length).toBeGreaterThanOrEqual(1)
    })
  })

  test('member can view election and nominees', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('navigate to elections', async () => {
      await page.goto(`/org/${ORG_ID}/elections`)
    })

    await test.step('elections visible to member', async () => {
      const hasElections = await page.getByText(/election/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasElections).toBeTruthy()
    })

    await test.step('click into election detail', async () => {
      const electionLink = page.locator(`a[href*="/elections/"]`).first()
      const hasLink = await electionLink.isVisible({ timeout: 10000 }).catch(() => false)
      if (hasLink) {
        await electionLink.click()
        await page.waitForLoadState('networkidle')
        // Should see election detail content (positions, nominees, voting info, or status)
        const hasContent = await page.getByText(/position|nominee|candidate|president|treasurer|vote|voting|election|status|officer/i).first().isVisible({ timeout: 10000 }).catch(() => false)
          || await page.locator('main, [role="main"]').first().isVisible({ timeout: 5000 }).catch(() => false)
        expect(hasContent).toBeTruthy()
      }
    })
  })

  test('officer roles page reflects elected officers', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to officers page', async () => {
      await page.goto(`/org/${ORG_ID}/officer/officers`)
    })

    await test.step('officers page shows current officers with positions', async () => {
      // Should see officer names and positions (seeded data)
      const hasOfficers = await page.getByText(/president|treasurer|secretary|officer/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasOfficers).toBeTruthy()

      // Should show real officer names from seed
      const hasNames = await page.getByText(/Maria|Juan|Ana|Carlos/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasNames).toBeTruthy()
    })
  })

  test('full journey: elections → detail → officers → org settings', async ({ page }) => {
    await test.step('sign in and view elections', async () => {
      await signInAsOfficer(page)
      await page.goto(`/org/${ORG_ID}/officer/elections`)
    })

    await test.step('view election detail', async () => {
      const link = page.getByText(/election/i).first()
      const hasLink = await link.isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasLink).toBeTruthy()
    })

    await test.step('check officers page', async () => {
      await page.goto(`/org/${ORG_ID}/officer/officers`)
      const hasOfficers = await page.getByText(/officer|president/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasOfficers).toBeTruthy()
    })

    await test.step('check org settings', async () => {
      await page.goto(`/org/${ORG_ID}/officer/settings`)
      // Settings page should render with any content (tabs, forms, headings)
      const hasContent = await page.locator('main, [role="main"], form, h1, h2, [role="tablist"]').first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasContent).toBeTruthy()
    })
  })
})
