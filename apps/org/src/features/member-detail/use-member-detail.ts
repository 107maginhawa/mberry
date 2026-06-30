import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  getRosterMember,
  listDuesPayments,
  listDuesInvoices,
  recordDuesPayment,
  refundDuesPayment,
  renewMembership,
} from '@monobase/sdk-ts/generated'

export type RosterMemberProfile = {
  personId: string
  name: string
  memberNumber?: string | null
  status: string
  joinedAt?: string | Date | null
  tier?: string | null
  duesExpiryDate?: string | Date | null
}

// Authoritative member profile by membership id (deep-link safe — no reliance on row state).
export function useRosterMember(membershipId: string | null, orgId: string | null): {
  member?: RosterMemberProfile
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const q = useQuery({
    queryKey: ['roster-member', membershipId],
    enabled: !!membershipId && !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getRosterMember({ path: { memberId: membershipId! }, query: { organizationId: orgId! } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('member failed')
      if (!data) throw new Error('member failed')
      const m = ((data as any).data ?? data) as any // envelope guard
      return {
        personId: m.personId,
        name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber ?? null,
        status: m.status,
        joinedAt: m.joinedAt ?? null,
        tier: m.categoryName ?? null,
        duesExpiryDate: m.duesExpiryDate ?? null,
      } satisfies RosterMemberProfile
    },
  })
  return { member: q.data, isLoading: q.isLoading, isError: q.isError, refetch: () => void q.refetch() }
}

// Manual payment methods an officer records offline. 'online' is excluded — that's the
// pay-link (PayMongo) rail, not something an officer types in. GCash is explicit (design A3).
export type PaymentMethod = 'cash' | 'gcash' | 'check' | 'bankTransfer' | 'other'

export type MemberPayment = {
  id: string
  receiptNumber?: string | null
  amount: number // centavos
  currency: string
  paymentMethod: string
  referenceNumber?: string | null
  status: string // completed | refunded | partiallyRefunded | pending | failed
  paidAt?: string | Date | null
  membershipExtendedTo?: string | Date | null
  refundedAmount: number
}

const OPEN_INVOICE = new Set(['generated', 'sent', 'overdue'])

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
    // engine BusinessLogicError → { error: { code, message } }
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message
    }
  }
  return undefined
}

function invalidateMember(qc: QueryClient) {
  // Prefix-invalidate every per-member view + the directory (status may change).
  qc.invalidateQueries({ queryKey: ['member-payments'] })
  qc.invalidateQueries({ queryKey: ['member-outstanding'] })
  qc.invalidateQueries({ queryKey: ['roster'] })
}

// Per-member payment timeline (officer view via the personId filter). x-org-id is
// injected by the API client. amount/refundedAmount are bigint at the seam → coerce.
export function useMemberPayments(personId: string | null): {
  payments: MemberPayment[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const q = useQuery({
    queryKey: ['member-payments', personId],
    enabled: !!personId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await listDuesPayments({ query: { personId: personId!, pageSize: 50 } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('payments failed')
      if (!data) throw new Error('payments failed')
      return (data.data as any[]).map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber ?? null,
        amount: Number(p.amount),
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber ?? null,
        status: p.status,
        paidAt: p.paidAt ?? null,
        membershipExtendedTo: p.membershipExtendedTo ?? null,
        refundedAmount: Number(p.refundedAmount ?? 0),
      })) as MemberPayment[]
    },
  })
  return { payments: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: () => void q.refetch() }
}

// Outstanding dues for one member (standing). Invoice money field is `totalAmount` (NOT amount).
export function useMemberOutstanding(membershipId: string | null): {
  outstanding: number
  openCount: number
  isLoading: boolean
} {
  const q = useQuery({
    queryKey: ['member-outstanding', membershipId],
    enabled: !!membershipId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({ query: { membershipId: membershipId!, pageSize: 50 } })
      if (!data) throw new Error('invoices failed')
      const open = (data.data as any[]).filter((i) => OPEN_INVOICE.has(i.status))
      return { openCount: open.length, outstanding: open.reduce((s, i) => s + Number(i.totalAmount), 0) }
    },
  })
  return { outstanding: q.data?.outstanding ?? 0, openCount: q.data?.openCount ?? 0, isLoading: q.isLoading }
}

export type RecordPaymentInput = {
  amount: number // centavos
  currency: string
  paymentMethod: PaymentMethod
  referenceNumber?: string
  invoiceId?: string
}

export function useRecordPayment(orgId: string | null, personId: string | null) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, RecordPaymentInput>({
    mutationFn: async (input) => {
      if (!orgId || !personId) throw new Error('Missing organization or member.')
      const { data, error, response } = await recordDuesPayment({
        // amount is centavos; the generated validator types it bigint (a number 400s as a
        // string) — cast at the SDK seam, mirroring use-bulk-send.
        body: { organizationId: orgId, personId, ...input, amount: input.amount as unknown as bigint },
      })
      if ((response as Response | undefined)?.status === 403) {
        throw new Error('Only the Treasurer or President can record payments.')
      }
      if (!data) throw new Error(serverError(error) ?? 'Could not record the payment.')
      return data
    },
    onSuccess: () => invalidateMember(qc),
  })
}

export function useRefundPayment() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { paymentId: string; amount?: number; reason?: string }>({
    mutationFn: async ({ paymentId, amount, reason }) => {
      const { data, error, response } = await refundDuesPayment({
        path: { paymentId },
        // amount (centavos) typed bigint by the generated validator — cast at the seam.
        body: { ...(amount != null ? { amount: amount as unknown as bigint } : {}), ...(reason ? { reason } : {}) },
      })
      if ((response as Response | undefined)?.status === 403) {
        throw new Error('Only the Treasurer or President can void payments.')
      }
      if (!data) throw new Error(serverError(error) ?? 'Could not void the payment.')
      return data
    },
    onSuccess: () => invalidateMember(qc),
  })
}

export function useRenewMembership() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { membershipId: string }>({
    mutationFn: async ({ membershipId }) => {
      const { data, error, response } = await renewMembership({ path: { membershipId } })
      if ((response as Response | undefined)?.status === 403) {
        throw new Error('You are not allowed to renew this membership.')
      }
      if (!data) throw new Error(serverError(error) ?? 'Could not renew the membership.')
      return data
    },
    onSuccess: () => invalidateMember(qc),
  })
}

// A refund is allowed only on a completed payment ≤30 days old (engine rule).
export function canVoid(p: MemberPayment): boolean {
  if (p.status !== 'completed') return false
  if (!p.paidAt) return true
  const ageDays = (Date.now() - new Date(p.paidAt).getTime()) / 86_400_000
  return Number.isNaN(ageDays) ? true : ageDays <= 30
}
