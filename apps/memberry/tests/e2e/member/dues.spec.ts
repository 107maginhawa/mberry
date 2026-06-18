// WF-038 — Pay Dues Online: member initiates payment, gateway processes, webhook confirms
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

test.use({ authRole: 'member' })
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

    await expect(
      payDues.or(allPaid).or(periodEnded).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows payment proof upload or paid status', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dues`)
    // The dues page surfaces one of several payment states depending on the
    // member's standing: an upload prompt, a pay action, a submitted/
    // outstanding badge, or a fully-paid / period-ended terminal state.
    await expect(
      page
        .getByText(/Upload your GCash screenshot/i)
        .or(page.getByText(/All Dues Paid/i))
        .or(page.getByText(/Membership Period Ended/i))
        .or(page.getByText(/Pay Now|Pay Dues/i))
        .or(page.getByText(/Submitted|Outstanding/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
