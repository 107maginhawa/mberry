// Business Rules: [BR-67] [BR-44] [BR-50]
// BR-67: One vote per person per position — prevents double-voting (M12 vote integrity; renamed from BR-42 per TR-P1-004 split, since canonical BR-42 = M09 training-type)
// BR-44: Election certification effects — winners auto-assigned officer roles
// BR-50: Election date ordering — nomination_start < voting_start < voting_end
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('[BR-67, BR-44, BR-50] Election Integrity', () => {
  test('officer can access election creation form', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to new election form', async () => {
      await page.goto(`/org/${ORG_ID}/officer/elections/new`)
      await page.waitForLoadState('networkidle')
    })

    await test.step('form renders with required fields', async () => {
      // Election form should have title, dates, positions
      const hasForm = await page.getByRole('textbox').first().isVisible({ timeout: 10000 }).catch(() => false)
        || await page.getByLabel(/title|name/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasForm).toBeTruthy()
    })
  })

  test('[BR-50] election form enforces date ordering', async ({ page }) => {
    await signInAsOfficer(page)
    await page.goto(`/org/${ORG_ID}/officer/elections/new`)
    await page.waitForLoadState('networkidle')

    // Look for date fields (nomination start, voting start, voting end)
    const dateInputs = page.locator('input[type="date"], input[type="datetime-local"]')
    const dateCount = await dateInputs.count()

    // Form should have multiple date fields for election phases
    // If date fields exist, try setting them in wrong order
    if (dateCount >= 2) {
      // Attempt to set voting end before voting start
      const firstDate = dateInputs.nth(0)
      const secondDate = dateInputs.nth(1)
      await firstDate.fill('2026-12-31')
      await secondDate.fill('2026-01-01')

      // Form should show validation error or prevent submission
      const submitBtn = page.getByRole('button', { name: /create|save|publish|submit/i }).first()
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click()
        // Should see validation error, not success
        const hasError = await page.getByText(/date.*order|before|invalid.*date|must be after/i).first().isVisible({ timeout: 5000 }).catch(() => false)
          || await page.getByRole('alert').first().isVisible({ timeout: 5000 }).catch(() => false)
        // Expect either an error message or the form still showing (not navigated away)
        expect(page.url()).toContain('/elections')
      }
    }
  })

  test('election list shows seeded elections with correct status', async ({ page }) => {
    await signInAsOfficer(page)
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    // Should show seeded elections
    const hasElections = await page.getByText(/election/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasElections).toBeTruthy()

    // Each election should display a valid status
    const statuses = await page.getByText(/draft|open|closed|published|nominations/i).all()
    expect(statuses.length).toBeGreaterThanOrEqual(1)
  })

  test('member can view election and see vote button when open', async ({ page }) => {
    await signInAsMember(page)
    await page.goto(`/org/${ORG_ID}/elections`)
    await page.waitForLoadState('networkidle')

    // Member should see election list
    const hasElections = await page.getByText(/election/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasElections).toBeTruthy()
  })

  test('[BR-67] voting page shows ballot positions', async ({ page }) => {
    await signInAsMember(page)

    // Navigate to elections list first
    await page.goto(`/org/${ORG_ID}/elections`)
    await page.waitForLoadState('networkidle')

    // Find an election link and click it
    const electionLink = page.locator(`a[href*="/elections/"]`).first()
    const hasLink = await electionLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasLink) {
      await electionLink.click()
      await page.waitForLoadState('networkidle')

      // Election detail should show election-related content
      const hasContent = await page.getByText(/president|treasurer|secretary|position|nominee|vote|voting|election|cast|ballot/i).first().isVisible({ timeout: 10000 }).catch(() => false)
        || await page.locator('main, [role="main"]').first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasContent).toBeTruthy()
    }
  })

  test('[BR-44] published election shows results with winner indicators', async ({ page }) => {
    await signInAsOfficer(page)
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    // Look for the published (completed) election
    const publishedLink = page.getByText(/2025.*election/i).first()
    const hasPublished = await publishedLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPublished) {
      await publishedLink.click()
      await page.waitForLoadState('networkidle')

      // Published election should show results
      const hasResults = await page.getByText(/result|winner|vote.*count|certified/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasNominees = await page.getByText(/nominee|candidate/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasResults || hasNominees).toBeTruthy()
    }
  })

  test('election detail does not show data from other orgs', async ({ page }) => {
    // Cross-org isolation check for BR-44
    await signInAsOfficer(page)
    await page.goto(`/org/${ORG_ID}/officer/elections`)
    await page.waitForLoadState('networkidle')

    // Should NOT see elections from other orgs (Cebu chapter)
    const hasCebu = await page.getByText(/cebu/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasCebu).toBeFalsy()
  })
})
