import { useQuery } from '@tanstack/react-query'
import { getMyMemberships, listDuesInvoices, listDuesPayments } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

// ─── Handler shapes (DRIFT-anchored) ──────────────────────────────────────────
// Never bind these to types.gen.ts — generated SDK types drift from frozen handlers.

/**
 * getMyMemberships handler returns orgName/duesExpiryDate/joinedAt — omitted by SDK type.
 * [review m8] duesExpiryDate is a STRING from the DB column; the memberships transformer
 * only converts startDate/endDate → Date. Wrap with new Date(duesExpiryDate) at display.
 */
export type HandlerMembership = {
  id: string
  organizationId: string
  orgId: string
  orgName: string | null            // DRIFT: SDK MyMembership omits this
  orgSlug: string | null
  status: string
  duesExpiryDate: string | null     // DRIFT: string — transformer does NOT date-convert this
  joinedAt: string | null           // DRIFT: omitted by SDK type
  startDate: string | null
  memberNumber: string | null
  tierId: string | null
  categoryId: string | null
  personId: string
}

/**
 * listDuesInvoices handler returns { data: [...enriched], pagination: {...} }.
 * totalAmount is bigint via the SDK transformer — always Number() at display.
 */
export type HandlerInvoice = {
  id: string
  invoiceNumber: string
  totalAmount: bigint | number      // bigint via listDuesInvoicesResponseTransformer
  currency: string
  status: string                    // 'generated' | 'sent' | 'overdue' | 'paid' | ...
  periodEnd: string | null
  memberName?: string | null
}

/**
 * listDuesPayments handler explicitly sets amount: Number(p.amount) but
 * listDuesPaymentsResponseTransformer reconverts it to bigint. Always Number() at display.
 */
export type HandlerPayment = {
  id: string
  receiptNumber: string | null
  amount: number | bigint           // Number from handler; transformer → bigint
  refundedAmount: number | bigint
  currency: string
  status: string
  paidAt: string | null
}

const OUTSTANDING_STATUSES = new Set(['generated', 'sent', 'overdue'])

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMemberData() {
  const { orgId } = useMemberOrg()

  const membershipsQuery = useQuery({
    queryKey: ['memberships'],
    retry: false,
    queryFn: async () => {
      // DRIFT: SDK MyMembership omits orgName/duesExpiryDate/joinedAt — cast to handler shape
      const { data, response } = await getMyMemberships()
      if (!response || !response.ok) throw new Error(`Memberships fetch failed: ${response?.status ?? 'no response'}`)
      if (!data) throw new Error('No membership data returned')
      return (data as any).data as HandlerMembership[]
    },
  })

  const invoicesQuery = useQuery({
    queryKey: ['my-dues-invoices', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // DRIFT: SDK DuesInvoice may mis-type totalAmount; cast to handler shape
      const { data, response } = await listDuesInvoices()
      if (!response || !response.ok) throw new Error(`Invoices fetch failed: ${response?.status ?? 'no response'}`)
      if (!data) throw new Error('No invoice data returned')
      return (data as any).data as HandlerInvoice[]
    },
  })

  const paymentsQuery = useQuery({
    queryKey: ['my-dues-payments', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // DRIFT: SDK DuesPayment amount field; cast to handler shape
      const { data, response } = await listDuesPayments()
      if (!response || !response.ok) throw new Error(`Payments fetch failed: ${response?.status ?? 'no response'}`)
      if (!data) throw new Error('No payment data returned')
      return (data as any).data as HandlerPayment[]
    },
  })

  const outstandingInvoices = (invoicesQuery.data ?? []).filter((inv) =>
    OUTSTANDING_STATUSES.has(inv.status),
  )

  return {
    membershipsQuery,
    invoicesQuery,
    paymentsQuery,
    outstandingInvoices,
  }
}
