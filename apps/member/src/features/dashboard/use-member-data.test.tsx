import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ─── Mocks (factory form — NOT vi.spyOn on generated ESM) ────────────────────
vi.mock('@monobase/sdk-ts/generated', () => ({
  getMyMemberships: vi.fn(),
  listDuesInvoices: vi.fn(),
  listDuesPayments: vi.fn(),
}))

vi.mock('@/features/org/use-member-org', () => ({
  useMemberOrg: vi.fn(),
}))

import { getMyMemberships, listDuesInvoices, listDuesPayments } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'
import { useMemberData } from './use-member-data'
import { ok, err } from '@/test-utils/mock-sdk'

// ─── Fixtures (anchored to handler shapes, not types.gen.ts) ─────────────────

const MEMBERSHIP = {
  // DRIFT: SDK MyMembership omits orgName/duesExpiryDate/joinedAt — handler returns them
  id: 'm1',
  organizationId: 'org-1',
  orgId: 'org-1',
  orgName: 'PDA Manila',
  orgSlug: 'pda-manila',
  status: 'active',
  duesExpiryDate: '2025-12-31',   // [review m8] string — transformer does NOT date-convert
  joinedAt: '2024-01-15',
  startDate: '2024-01-15',
  memberNumber: 'M-001',
  tierId: null,
  categoryId: null,
  personId: 'person-1',
}

const INVOICE = {
  // DRIFT: totalAmount is bigint via listDuesInvoicesResponseTransformer
  id: 'inv-1',
  invoiceNumber: 'INV-2025-001',
  totalAmount: 150000n,   // ₱1,500.00 in centavos; bigint via transformer
  currency: 'PHP',
  status: 'generated',
  periodEnd: '2025-12-31',
  memberName: 'Olive Cruz',
}

const PAYMENT = {
  // DRIFT: amount is Number from handler, but transformer → bigint
  id: 'pay-1',
  receiptNumber: 'REC-2025-001',
  amount: 150000n,   // Number in handler; transformer reconverts to bigint
  refundedAmount: 0n,
  currency: 'PHP',
  status: 'confirmed',
  paidAt: '2025-01-15T10:00:00.000Z',
}

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useMemberData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: orgId null (session loading / not yet resolved)
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: null, memberships: [], select: vi.fn() })
  })

  // ── membershipsQuery ───────────────────────────────────────────────────────

  it('membershipsQuery: returns data on success', async () => {
    vi.mocked(getMyMemberships).mockResolvedValue(
      // DRIFT cast: handler returns orgName/duesExpiryDate/joinedAt; SDK type omits them
      ok({ data: [MEMBERSHIP], total: 1 } as any),
    )

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.membershipsQuery.isSuccess).toBe(true))

    const m = result.current.membershipsQuery.data![0]!
    expect(m.orgName).toBe('PDA Manila')
    expect(m.duesExpiryDate).toBe('2025-12-31') // [review m8] stays as string
    expect(m.joinedAt).toBe('2024-01-15')
    expect(m.status).toBe('active')
  })

  it('membershipsQuery: isError on 401', async () => {
    vi.mocked(getMyMemberships).mockResolvedValue(err(401) as any)
    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.membershipsQuery.isError).toBe(true))
  })

  // ── dues queries disabled when orgId null ──────────────────────────────────

  it('dues queries: enabled:false when orgId null — no SDK calls', async () => {
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.membershipsQuery.isSuccess).toBe(true))

    expect(listDuesInvoices).not.toHaveBeenCalled()
    expect(listDuesPayments).not.toHaveBeenCalled()
    expect(result.current.invoicesQuery.fetchStatus).toBe('idle')
    expect(result.current.paymentsQuery.fetchStatus).toBe('idle')
  })

  // ── [review I6] null → set transition ─────────────────────────────────────

  it('[I6] dues queries fire when orgId flips null → set (prevents "owes dues but sees paid up" race)', async () => {
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [MEMBERSHIP], total: 1 } as any),
    )
    vi.mocked(listDuesInvoices).mockResolvedValue(
      ok({ data: [INVOICE], pagination: { offset: 0, limit: 20, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } } as any),
    )
    vi.mocked(listDuesPayments).mockResolvedValue(
      ok({ data: [PAYMENT], totalCount: 1 } as any),
    )

    // Phase 1: orgId null — dues queries MUST NOT fire
    const { result, rerender } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.membershipsQuery.isSuccess).toBe(true))
    expect(listDuesInvoices).not.toHaveBeenCalled()
    expect(listDuesPayments).not.toHaveBeenCalled()

    // Phase 2: orgId set — dues queries MUST fire
    act(() => {
      vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    })
    rerender()

    await waitFor(() => expect(listDuesInvoices).toHaveBeenCalledOnce())
    await waitFor(() => expect(listDuesPayments).toHaveBeenCalledOnce())
    await waitFor(() => expect(result.current.invoicesQuery.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.paymentsQuery.isSuccess).toBe(true))
  })

  // ── invoicesQuery ──────────────────────────────────────────────────────────

  it('invoicesQuery: returns data when orgId set', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    vi.mocked(listDuesInvoices).mockResolvedValue(
      ok({ data: [INVOICE], pagination: { offset: 0, limit: 20, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } } as any),
    )

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.invoicesQuery.isSuccess).toBe(true))

    expect(result.current.invoicesQuery.data![0]!.invoiceNumber).toBe('INV-2025-001')
    // totalAmount bigint via transformer: Number() at display gives 150000
    expect(Number(result.current.invoicesQuery.data![0]!.totalAmount)).toBe(150000)
  })

  it('invoicesQuery: isError on 401', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    vi.mocked(listDuesInvoices).mockResolvedValue(err(401) as any)

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.invoicesQuery.isError).toBe(true))
  })

  // ── paymentsQuery ──────────────────────────────────────────────────────────

  it('paymentsQuery: returns data when orgId set', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    vi.mocked(listDuesPayments).mockResolvedValue(
      ok({ data: [PAYMENT], totalCount: 1 } as any),
    )

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.paymentsQuery.isSuccess).toBe(true))

    const p = result.current.paymentsQuery.data![0]!
    expect(p.receiptNumber).toBe('REC-2025-001')
    // amount transformer → bigint; Number() at display gives 150000
    expect(Number(p.amount)).toBe(150000)
  })

  it('paymentsQuery: isError on 401', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    vi.mocked(listDuesPayments).mockResolvedValue(err(401) as any)

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.paymentsQuery.isError).toBe(true))
  })

  // ── outstandingInvoices filter ─────────────────────────────────────────────

  it('outstandingInvoices: only generated/sent/overdue statuses', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    vi.mocked(listDuesInvoices).mockResolvedValue(
      ok({
        data: [
          { ...INVOICE, id: 'inv-1', status: 'generated' },
          { ...INVOICE, id: 'inv-2', status: 'sent' },
          { ...INVOICE, id: 'inv-3', status: 'overdue' },
          { ...INVOICE, id: 'inv-4', status: 'paid' },      // excluded
          { ...INVOICE, id: 'inv-5', status: 'cancelled' }, // excluded
        ],
        pagination: { offset: 0, limit: 20, count: 5, totalCount: 5, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
      } as any),
    )

    const { result } = renderHook(() => useMemberData(), { wrapper })
    await waitFor(() => expect(result.current.invoicesQuery.isSuccess).toBe(true))

    expect(result.current.outstandingInvoices).toHaveLength(3)
    expect(result.current.outstandingInvoices.map((i) => i.id)).toEqual(['inv-1', 'inv-2', 'inv-3'])
  })
})
