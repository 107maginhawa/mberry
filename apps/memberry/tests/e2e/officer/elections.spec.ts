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
})
