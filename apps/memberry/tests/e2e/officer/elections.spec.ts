// Business Rules: [BR-33]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Elections', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('elections list renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /elections?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows seeded election 2026 Officer Election', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/2026 officer election/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Create Election button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    const createBtn = page.getByRole('link', { name: /create election|new election/i })
      .or(page.getByRole('button', { name: /create election|new election/i }))
      .first()
    await expect(createBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to election detail showing positions', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    // Click on the seeded election
    const electionLink = page.getByText(/2026 officer election/i).first()
    await expect(electionLink).toBeVisible({ timeout: 10000 })
    await electionLink.click()

    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/officer/elections/')

    // Detail page should show positions
    const hasPositions = await page.getByText(/position/i).first().isVisible().catch(() => false)
    const hasPresident = await page.getByText(/president/i).first().isVisible().catch(() => false)
    const hasDraft = await page.getByText(/draft/i).first().isVisible().catch(() => false)
    expect(hasPositions || hasPresident || hasDraft).toBeTruthy()
  })

  test('BR-33: election detail shows valid status (Draft/Open/Closed)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    const electionLink = page.getByText(/2026 officer election/i).first()
    await expect(electionLink).toBeVisible({ timeout: 10000 })
    await electionLink.click()
    await page.waitForLoadState('networkidle')

    // BR-33: Election must show a valid status — not undefined or empty
    const statusBadge = page.getByText(/^(Draft|Open|Closed|Voting|Completed)$/i).first()
    await expect(statusBadge).toBeVisible({ timeout: 10000 })
  })

  test('BR-33: election detail shows position count', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    const electionLink = page.getByText(/2026 officer election/i).first()
    await expect(electionLink).toBeVisible({ timeout: 10000 })
    await electionLink.click()
    await page.waitForLoadState('networkidle')

    // BR-33: Should show at least one position (President is always in seeded data)
    const hasPosition = await page.getByText(/president/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasPosition).toBe(true)
  })

  test('BR-33: election integrity — status restricts voting actions', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    const electionLink = page.getByText(/2026 officer election/i).first()
    await expect(electionLink).toBeVisible({ timeout: 10000 })
    await electionLink.click()
    await page.waitForLoadState('networkidle')

    // Read election status
    const statusBadge = page.getByText(/^(Draft|Open|Closed|Voting|Completed)$/i).first()
    await expect(statusBadge).toBeVisible({ timeout: 10000 })
    const status = await statusBadge.textContent()

    if (status?.toLowerCase() === 'draft') {
      // Draft elections should NOT show voting UI
      const hasVoteBtn = await page.getByRole('button', { name: /cast vote|vote/i }).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasVoteBtn).toBe(false)

      // Draft elections should show "Open Voting" button for officers
      const hasOpenVoting = await page.getByRole('button', { name: /open voting/i }).isVisible({ timeout: 3000 }).catch(() => false)
      // Either shows Open Voting or shows the draft management UI
      const hasDraftUI = await page.getByText(/nominees|add nominee|nominate/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasOpenVoting || hasDraftUI).toBeTruthy()
    } else if (status?.toLowerCase() === 'closed' || status?.toLowerCase() === 'completed') {
      // Closed elections should show results, NOT voting buttons
      const hasVoteBtn = await page.getByRole('button', { name: /cast vote|vote/i }).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasVoteBtn).toBe(false)
    }
    // Voting/Open status: vote buttons may be visible — that's correct
  })
})
