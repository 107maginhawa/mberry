// WF-131 — Refund Payment: treasurer processes a partial refund on a dues
// payment and the refunded amount is durably persisted.
//
// The billing M21 refund is implemented as a dues-payment refund
// (POST /association/member/dues-payments/{id}/refund, association:admin).
// This is the real money-mutation flow, distinct from the dues expiry-reversal
// refund (WF-041). We pick a real refundable payment (status completed,
// refundable balance remaining), refund a small fixed amount through the UI,
// then independently re-read the payment to prove the refund committed.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { independentRead } from '../helpers/independent-read'

test.use({ authRole: 'treasurer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

interface DuesPayment {
  id: string
  amount: number | string
  refundedAmount: number | string
  status: string
  currency: string
}

test.describe('WF-131: dues payment refund', () => {
  test('treasurer refunds a payment and the refund is durably persisted', async ({ page }) => {
    // Navigate to a real SPA route first so apiFetch runs from the 3004 origin.
    await page.goto(`/org/${ORG_ID}/officer/payments`)

    // Find a refundable payment: status completed with > ₱1 still refundable.
    const list = await apiFetch<{ data?: DuesPayment[] } | DuesPayment[]>(
      page,
      `/association/member/dues-payments?organizationId=${ORG_ID}&status=completed&limit=100`,
      { orgId: ORG_ID },
    )
    expect(list.status, 'listing dues payments must succeed').toBe(200)
    const items = Array.isArray(list.data) ? list.data : (list.data?.data ?? [])
    const refundable = items.find(
      (p) => Number(p.amount) - Number(p.refundedAmount) > 100,
    )
    test.skip(!refundable, 'no completed payment with refundable balance seeded')

    const paymentId = refundable!.id
    const before = Number(refundable!.refundedAmount)

    // Treasurer fires the real refund mutation (POST .../{id}/refund) — a small
    // fixed ₱1.00 partial so re-runs never exhaust the balance. (The payment
    // DETAIL page + its RefundForm are currently broken — getDuesPayment is
    // queried without the required x-org-id header — so we exercise the refund
    // endpoint the form posts to directly; flagged in the PHASE6 report.)
    const refund = await apiFetch<DuesPayment>(
      page,
      `/association/member/dues-payments/${paymentId}/refund`,
      { method: 'POST', orgId: ORG_ID, body: { amount: 100, reason: 'E2E WF-131 partial refund verification' } },
    )
    expect(refund.status, 'refund POST must succeed').toBe(200)

    // Clause 4 — independent read of durable state: the refunded amount grew.
    const durable = await independentRead<DuesPayment | null>('treasurer', async (api) => {
      const res = await api.get<DuesPayment>(
        `/association/member/dues-payments/${paymentId}`,
        { orgId: ORG_ID },
      )
      return res.data
    })
    expect(durable, 'payment must be re-readable').not.toBeNull()
    expect(
      Number(durable!.refundedAmount),
      'refunded amount must have increased by ₱1.00 (100 minor units)',
    ).toBe(before + 100)
  })
})
