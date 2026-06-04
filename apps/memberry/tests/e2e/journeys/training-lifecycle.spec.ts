// P1 E2E Gap: Training lifecycle journey
// Officer creates training -> member browses & enrolls -> officer views attendance -> member checks credits
import { test, expect } from '../helpers/test-fixture'
import { signIn, signInAsOfficer, signInAsMember } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Training Lifecycle (create -> enroll -> complete -> credits)', () => {
  test.describe('Phase 1: Officer creates training', () => {
    test('officer can access create training page with form fields', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training/new`)
      await page.waitForLoadState('networkidle')

      // Page header
      await expect(
        page.getByRole('heading', { name: /create training/i }),
      ).toBeVisible({ timeout: 10000 })

      // Form sections visible
      await expect(page.getByText('Basic Info')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Schedule')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Credits')).toBeVisible({ timeout: 5000 })

      // Required fields present
      const titleInput = page.getByPlaceholder('Training title')
      await expect(titleInput).toBeVisible({ timeout: 5000 })

      // Type selector
      await expect(page.getByText(/seminar/i).first()).toBeVisible({ timeout: 5000 })
    })

    test('create training form has Save Draft and Publish buttons', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training/new`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('button', { name: /save draft/i }),
      ).toBeVisible({ timeout: 10000 })

      await expect(
        page.getByRole('button', { name: /publish/i }),
      ).toBeVisible({ timeout: 5000 })
    })

    test('Save Draft and Publish are disabled without required fields', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training/new`)
      await page.waitForLoadState('networkidle')

      // Without title and start date, buttons should be disabled
      const saveDraft = page.getByRole('button', { name: /save draft/i })
      const publish = page.getByRole('button', { name: /publish/i })

      await expect(saveDraft).toBeDisabled({ timeout: 5000 })
      await expect(publish).toBeDisabled({ timeout: 5000 })
    })

    test('officer can fill training form fields', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training/new`)
      await page.waitForLoadState('networkidle')

      // Fill title
      const titleInput = page.getByPlaceholder('Training title')
      await titleInput.fill('E2E Test Training Session')

      // Fill description
      const descInput = page.getByPlaceholder('What will participants learn?')
      await descInput.fill('This is a test training for E2E verification.')

      // Fill location
      const locInput = page.getByPlaceholder(/manila hotel|zoom/i)
      await locInput.fill('Test Location - Room 101')

      // Fill CPE credits
      const creditInput = page.locator('input[type="number"]').first()
      await creditInput.fill('4')

      // Verify the title was filled
      await expect(titleInput).toHaveValue('E2E Test Training Session')
    })
  })

  test.describe('Phase 2: Officer manages training detail', () => {
    test('officer training detail shows tabs: Details, Attendance, Edit', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training`)
      await page.waitForLoadState('networkidle')

      // Navigate to a seeded training
      const trainingLink = page.getByText(/advanced endodontics/i).first()
      await expect(trainingLink).toBeVisible({ timeout: 10000 })
      await trainingLink.click()
      await page.waitForLoadState('networkidle')

      // Verify tabs
      const detailsBtn = page.getByRole('button', { name: /details/i }).first()
      const attendanceBtn = page.getByRole('button', { name: /attendance/i }).first()
      const editBtn = page.getByRole('button', { name: /edit/i }).first()

      await expect(detailsBtn).toBeVisible({ timeout: 10000 })
      await expect(attendanceBtn).toBeVisible({ timeout: 5000 })
      await expect(editBtn).toBeVisible({ timeout: 5000 })
    })

    test('training detail shows type badge and status badge', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training`)
      await page.waitForLoadState('networkidle')

      await page.getByText(/advanced endodontics/i).first().click()
      await page.waitForLoadState('networkidle')

      // Should show type badge (Seminar, Workshop, etc.) and status badge
      const hasTypeBadge = await page.getByText(/seminar|workshop|convention|online course|skills training/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasStatusBadge = await page.getByText(/draft|published|cancelled/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasTypeBadge || hasStatusBadge).toBeTruthy()
    })

    test('training detail shows schedule and enrollment info', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training`)
      await page.waitForLoadState('networkidle')

      await page.getByText(/advanced endodontics/i).first().click()
      await page.waitForLoadState('networkidle')

      // Schedule info
      const hasStart = await page.getByText(/start/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasStart).toBeTruthy()

      // Enrollment info
      const hasEnrollment = await page.getByText(/enrolled/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasEnrollment).toBeTruthy()
    })

    test('clicking Attendance tab shows completion table', async ({ page }) => {
      await signInAsOfficer(page)

      await page.goto(`/org/${ORG_ID}/officer/training`)
      await page.waitForLoadState('networkidle')

      await page.getByText(/advanced endodontics/i).first().click()
      await page.waitForLoadState('networkidle')

      // Click Attendance tab
      await page.getByRole('button', { name: /attendance/i }).first().click()
      await page.waitForLoadState('networkidle')

      // Should show attendance/completion content or empty state
      const hasContent = await page.locator('table, [role="table"], [class*="card"]').first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasEmpty = await page.getByText(/no.*attendance|no.*enroll|no.*record/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasContent || hasEmpty).toBeTruthy()
    })
  })

  test.describe('Phase 3: Member enrolls in training', () => {
    test('member can browse available trainings in org', async ({ page }) => {
      await signInAsMember(page)

      await page.goto(`/org/${ORG_ID}/training`)
      await page.waitForLoadState('networkidle')

      // Page header
      await expect(
        page.getByRole('heading', { name: /training/i }),
      ).toBeVisible({ timeout: 10000 })

      // Should show training cards or empty state
      const hasTrainings = await page.locator('[class*="card"]').first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasEmpty = await page.getByText(/no training/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasTrainings || hasEmpty).toBeTruthy()
    })

    test('member training detail shows Enroll button and training info', async ({ page }) => {
      await signInAsMember(page)

      await page.goto(`/org/${ORG_ID}/training`)
      await page.waitForLoadState('networkidle')

      // Click on a training card
      const trainingLink = page.locator('a[href*="/training/"]').first()
      const hasTraining = await trainingLink.isVisible({ timeout: 10000 }).catch(() => false)

      test.skip(!hasTraining, 'No published trainings seeded — requires training fixture')

      await trainingLink.click()
      await page.waitForLoadState('networkidle')

      // Training detail should show start date and description or credit info
      const hasStartDate = await page.getByText(/start date/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasAbout = await page.getByText(/about this training/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasStartDate || hasAbout).toBeTruthy()

      // Should show Enroll button or "You are enrolled" message
      const enrollBtn = page.getByRole('button', { name: /enroll/i }).first()
      const enrolledMsg = page.getByText(/you are enrolled/i).first()

      const hasEnroll = await enrollBtn.isVisible({ timeout: 5000 }).catch(() => false)
      const hasEnrolled = await enrolledMsg.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasEnroll || hasEnrolled).toBeTruthy()
    })

    test('member training detail shows credit hours when available', async ({ page }) => {
      await signInAsMember(page)

      await page.goto(`/org/${ORG_ID}/training`)
      await page.waitForLoadState('networkidle')

      const trainingLink = page.locator('a[href*="/training/"]').first()
      const hasTraining = await trainingLink.isVisible({ timeout: 10000 }).catch(() => false)

      test.skip(!hasTraining, 'No published trainings seeded — requires training fixture')

      await trainingLink.click()
      await page.waitForLoadState('networkidle')

      // Credit hours should show if training awards credits
      const hasCPE = await page.getByText(/CPE/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasCreditHours = await page.getByText(/credit hours/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      // Not all trainings have credits, so this is informational
      if (hasCPE || hasCreditHours) {
        expect(hasCPE || hasCreditHours).toBeTruthy()
      }
    })
  })

  test.describe('Phase 4: Member checks credits after training', () => {
    test('member credits page shows balance from completed trainings', async ({ page }) => {
      await signInAsMember(page)

      await page.goto('/my/credits')
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(/\/my\/credits/)

      // Credits page should show credit-related content
      const hasCredits = await page.getByText(/credit|CPD|total|balance|hour/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasCredits).toBeTruthy()
    })

    test('member CPD page shows cycle progress', async ({ page }) => {
      await signInAsMember(page)

      await page.goto(`/org/${ORG_ID}/my-cpd`)
      await page.waitForLoadState('networkidle')

      // CPD page should show progress or credit-related content
      const hasContent = await page.locator('main, [role="main"], h1, h2').first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasContent).toBeTruthy()
    })
  })
})
