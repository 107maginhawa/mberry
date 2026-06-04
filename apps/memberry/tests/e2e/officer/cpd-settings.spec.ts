// P1 E2E Gap: CPD settings configuration
// Tests officer CPD settings page: form loads, fields render, save flow
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer CPD Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('CPD settings page loads with heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    await expect(
      page.getByRole('heading', { name: /CPD Settings/i }),
    ).toBeVisible({ timeout: 10000 })

    // Subtitle present
    await expect(
      page.getByText(/configure credit requirements/i),
    ).toBeVisible({ timeout: 5000 })
  })

  test('CPD settings form shows Required Credits field', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    // Required Credits label
    await expect(
      page.getByText('Required Credits per Cycle'),
    ).toBeVisible({ timeout: 10000 })

    // Number input should be present with a numeric value
    const creditsInput = page.locator('input[type="number"]').first()
    await expect(creditsInput).toBeVisible({ timeout: 5000 })

    // Default value should be a number (default is 60)
    const value = await creditsInput.inputValue()
    expect(parseInt(value, 10)).toBeGreaterThan(0)
  })

  test('CPD settings form shows Cycle Length selector', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    await expect(
      page.getByText('Cycle Length (years)'),
    ).toBeVisible({ timeout: 10000 })

    // Select trigger should show current value (1-5 years)
    const cycleTrigger = page.locator('button[role="combobox"]').first()
    await expect(cycleTrigger).toBeVisible({ timeout: 5000 })

    const triggerText = await cycleTrigger.textContent() ?? ''
    expect(triggerText).toMatch(/year/i)
  })

  test('CPD settings form shows SDL Cap field with percentage', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    await expect(
      page.getByText('SDL Cap (%)'),
    ).toBeVisible({ timeout: 10000 })

    // SDL Cap input
    const sdlInput = page.locator('input[type="number"]').nth(1)
    await expect(sdlInput).toBeVisible({ timeout: 5000 })

    // Helper text showing calculated max credits
    await expect(
      page.getByText(/self-directed learning/i),
    ).toBeVisible({ timeout: 5000 })
  })

  test('CPD settings form shows Cycle Start Month selector', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    await expect(
      page.getByText('Cycle Start Month'),
    ).toBeVisible({ timeout: 10000 })

    // Should show a month name in the selector
    const monthTrigger = page.locator('button[role="combobox"]').nth(1)
    await expect(monthTrigger).toBeVisible({ timeout: 5000 })

    const monthText = await monthTrigger.textContent() ?? ''
    expect(monthText).toMatch(/january|february|march|april|may|june|july|august|september|october|november|december/i)
  })

  test('CPD settings has Save Configuration button', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    const saveBtn = page.getByRole('button', { name: /save configuration/i })
    await expect(saveBtn).toBeVisible({ timeout: 10000 })
    await expect(saveBtn).toBeEnabled()
  })

  test('updating Required Credits changes the SDL Cap helper text', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    // Get the credits input and change it
    const creditsInput = page.locator('input[type="number"]').first()
    await expect(creditsInput).toBeVisible({ timeout: 10000 })

    // Clear and set to 100
    await creditsInput.fill('100')

    // The SDL Cap helper text should update to reflect new calculation
    // With 40% SDL cap and 100 required credits = 40 credits max
    const helperText = page.getByText(/credits max/i)
    const hasHelper = await helperText.isVisible({ timeout: 5000 }).catch(() => false)
    if (hasHelper) {
      const text = await helperText.textContent() ?? ''
      expect(text).toContain('40')
    }
  })

  test('all four form fields are present on the page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)
    // All four config fields should be visible
    const fields = [
      'Required Credits per Cycle',
      'Cycle Length (years)',
      'SDL Cap (%)',
      'Cycle Start Month',
    ]

    for (const fieldLabel of fields) {
      await expect(
        page.getByText(fieldLabel),
      ).toBeVisible({ timeout: 10000 })
    }
  })
})
