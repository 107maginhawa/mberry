import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Communications', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('communications list renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /communications?|announcements?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows seeded announcement May Dues Reminder', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/may dues reminder/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('New Message or Announcement button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()
    await expect(newBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to new announcement form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')

    const newBtn = page.getByRole('link', { name: /new (message|announcement)|create (message|announcement)/i })
      .or(page.getByRole('button', { name: /new (message|announcement)|create (message|announcement)/i }))
      .first()
    await newBtn.click()

    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/communications/new')
  })
})
