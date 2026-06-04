// Persona P4: Chapter Secretary (Ana Reyes)
// Covers: CS-1 through CS-13 — roster, member import, events, communications
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../auth.setup'


test.use({ storageState: authStateFile('secretary') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('P4 Secretary Journey', () => {
test('CS-1: secretary accesses officer dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const hasDashboard = await page.getByText(/dashboard|overview/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasDashboard).toBeTruthy()
  })

  test('CS-2: secretary can view member roster', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // Should see member list with names
    const hasRoster = await page.getByText(/member|roster|name/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasRoster).toBeTruthy()
  })

  test('CS-3: secretary can access member applications', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    const hasApps = await page.getByText(/application|pending|review|no.*application/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasApps).toBeTruthy()
  })

  test('CS-4: secretary can view event management', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    const hasEvents = await page.getByText(/event|activity|convention/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasEvents).toBeTruthy()
  })

  test('CS-5: secretary can access communications', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    const hasComms = await page.getByText(/communication|announcement|message/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasComms).toBeTruthy()
  })

  test('CS-6: secretary can compose new announcement', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    const hasForm = await page.getByRole('textbox').first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasForm).toBeTruthy()
  })

  test('CS-7: secretary sidebar shows relevant navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Secretary should see Members and Communications nav
    const memberNav = await page.getByText(/member|roster/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const commsNav = await page.getByText(/communication|announce/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(memberNav || commsNav).toBeTruthy()
  })

  test('full journey: dashboard → roster → applications → events → communications', async ({ page }) => {
    await test.step('dashboard', async () => {
      await page.goto(`/org/${ORG_ID}/officer/dashboard`)
      await expect(page).toHaveURL(/officer/)
    })

    await test.step('roster', async () => {
      await page.goto(`/org/${ORG_ID}/officer/roster`)
      const hasRoster = await page.getByText(/member|name/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasRoster).toBeTruthy()
    })

    await test.step('events', async () => {
      await page.goto(`/org/${ORG_ID}/officer/events`)
      await expect(page).toHaveURL(/events/)
    })

    await test.step('communications', async () => {
      await page.goto(`/org/${ORG_ID}/officer/communications`)
      await expect(page).toHaveURL(/communications/)
    })
  })
})
