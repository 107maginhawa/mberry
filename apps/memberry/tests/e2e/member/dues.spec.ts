// WF-038 — Pay Dues Online: member initiates payment, gateway processes, webhook confirms
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member Dues (/org/$orgId/dues)', () => {
test('shows My Dues heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dues`)
    await expect(page.getByRole('heading', { name: 'My Dues', level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('shows dues status', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dues`)
    const payDues = page.getByText('Pay Dues')
    const allPaid = page.getByText('All Dues Paid')
    const periodEnded = page.getByText('Membership Period Ended')

    const isPayDuesVisible = await payDues.isVisible()
    const isAllPaidVisible = await allPaid.isVisible()
    const isPeriodEndedVisible = await periodEnded.isVisible()

    expect(isPayDuesVisible || isAllPaidVisible || isPeriodEndedVisible).toBe(true)
  })

  test('shows payment proof upload or paid status', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dues`)
    const proofUpload = page.getByText('Upload your GCash screenshot')
    const allPaid = page.getByText('All Dues Paid')
    const periodEnded = page.getByText('Membership Period Ended')

    const isProofUploadVisible = await proofUpload.isVisible()
    const isAllPaidVisible = await allPaid.isVisible()
    const isPeriodEndedVisible = await periodEnded.isVisible()

    expect(isProofUploadVisible || isAllPaidVisible || isPeriodEndedVisible).toBe(true)
  })
})
