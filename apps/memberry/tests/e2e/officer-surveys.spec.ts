import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from './helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Feedback: Officer Surveys', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('surveys page loads without error', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)
    await page.waitForLoadState('networkidle')

    // Should NOT show error state
    await expect(page.getByText('Failed to load surveys')).not.toBeVisible()

    // Page header renders
    await expect(page.getByRole('heading', { name: 'Surveys' })).toBeVisible()
  })

  test('survey stats cards render', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)
    await page.waitForLoadState('networkidle')

    // Stats row renders with labeled cards (use exact match to avoid tab collisions)
    await expect(page.getByText('Total', { exact: true })).toBeVisible()
    await expect(page.getByText('Drafts', { exact: true })).toBeVisible()
  })

  test('tab filters are clickable', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)
    await page.waitForLoadState('networkidle')

    // Tab bar renders with filter tabs
    const allTab = page.getByRole('tab', { name: /All/i })
    const draftTab = page.getByRole('tab', { name: /Draft/i })
    const activeTab = page.getByRole('tab', { name: /Active/i })
    const closedTab = page.getByRole('tab', { name: /Closed/i })

    await expect(allTab).toBeVisible()
    await expect(draftTab).toBeVisible()
    await expect(activeTab).toBeVisible()
    await expect(closedTab).toBeVisible()

    // Click draft tab — should not crash
    await draftTab.click()
    await expect(draftTab).toHaveAttribute('data-state', 'active')
  })

  test('New Survey button navigates to creation page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)
    await page.waitForLoadState('networkidle')

    const newBtn = page.getByRole('link', { name: /New Survey/i })
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    // Verify creation page renders
    await expect(page.getByRole('heading', { name: /New Survey/i })).toBeVisible()
  })
})
