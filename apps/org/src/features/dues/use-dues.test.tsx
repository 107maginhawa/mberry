import { it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getDuesDashboard: vi.fn(), listDuesPayments: vi.fn(), listDuesInvoices: vi.fn() }))
import { getDuesDashboard, listDuesPayments, listDuesInvoices } from '@monobase/sdk-ts/generated'
import type { ListDuesPaymentsResponse, ListDuesInvoicesResponse } from '@monobase/sdk-ts/generated'
import { useDuesDashboard, useRecentPayments, useOutstandingInvoices } from './use-dues'
import { ok } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Shared pagination stub — hook reads data.data only; pagination shape is ignored at runtime.
const PAGE1 = { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false }

// ─── Dashboard ───────────────────────────────────────────────────────────────

it('useDuesDashboard coerces money fields to number and exposes collectionRate+memberCount', async () => {
  // engine type/impl drift: handler returns {data:{...collectionRate,memberCount}} but generated type
  // omits collectionRate/memberCount and requires upcomingActivities. Anchor to handler.
  vi.mocked(getDuesDashboard).mockResolvedValue(
    ok({ data: { totalCollected: 250000, totalOutstanding: 500000, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 } } as any)
  )
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data!.totalCollected).toBe(250000)
  expect(typeof result.current.data!.totalCollected).toBe('number')
  expect(result.current.data!.totalOutstanding).toBe(500000)
  expect(typeof result.current.data!.totalOutstanding).toBe('number')
  expect(result.current.data!.collectionRate).toBe(33)
  expect(result.current.data!.memberCount).toBe(3)
})

it('useDuesDashboard falls back collectionRate+memberCount when handler omits them', async () => {
  // Simulates a future engine version that drops these fields
  // engine type/impl drift: see above
  vi.mocked(getDuesDashboard).mockResolvedValue(
    ok({ data: { totalCollected: 0, totalOutstanding: 0, paidCount: 2, unpaidCount: 3, overdueCount: 1 } } as any)
  )
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  // memberCount fallback = paidCount + unpaidCount + overdueCount = 6
  expect(result.current.data!.memberCount).toBe(6)
  // collectionRate fallback = round(2/6 * 100) = 33
  expect(result.current.data!.collectionRate).toBe(33)
})

it('useDuesDashboard surfaces isError and exposes a callable refetch on failure', async () => {
  vi.mocked(getDuesDashboard).mockRejectedValue(new Error('boom'))
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.data).toBeUndefined()
  expect(typeof result.current.refetch).toBe('function')
  // Calling refetch must not throw
  expect(() => result.current.refetch()).not.toThrow()
})

// ─── Payments ────────────────────────────────────────────────────────────────

it('useRecentPayments coerces amount + refundedAmount to number', async () => {
  vi.mocked(listDuesPayments).mockResolvedValue(
    ok<ListDuesPaymentsResponse>({
      data: [{
        id: 'p1', version: 1, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
        organizationId: 'o1', personId: 'p1', receiptNumber: 'REC-001',
        amount: 100000n, currency: 'PHP', paymentMethod: 'gcash', refundedAmount: 0n, status: 'completed',
      }],
      pagination: { ...PAGE1, limit: 20 },
    })
  )
  const { result } = renderHook(() => useRecentPayments('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(100000)
  expect(typeof result.current.data![0].amount).toBe('number')
  expect(typeof (result.current.data![0] as any).refundedAmount).toBe('number')
})

// ─── Invoices ────────────────────────────────────────────────────────────────

it('useOutstandingInvoices maps totalAmount→amount (CRIT-1: invoice has no amount field)', async () => {
  // Ground-truth handler shape: field is `totalAmount`, NOT `amount`.
  // Note: handler also sends memberName on items at runtime but DuesInvoice type omits it
  // (handler-added JOIN field; drift documented; no assertion depends on it here).
  vi.mocked(listDuesInvoices).mockResolvedValue(
    ok<ListDuesInvoicesResponse>({
      data: [{
        id: 'inv1', version: 1, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
        membershipId: 'ms1', personId: 'p1', organizationId: 'o1',
        invoiceNumber: 'INV-001', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-12-31'),
        totalAmount: 200000n, fundAllocations: [], status: 'sent', generatedAt: new Date('2026-01-01'),
      }],
      pagination: PAGE1,
    })
  )
  const { result } = renderHook(() => useOutstandingInvoices('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(200000)
  // Proves the fix: with old code (i.amount) this would be NaN
  expect(isFinite(result.current.data![0].amount)).toBe(true)
  expect(typeof result.current.data![0].amount).toBe('number')
})

it('useOutstandingInvoices IMP-2: includes both sent AND overdue invoices', async () => {
  // Hook makes two calls — use mockImplementation to route by status param
  vi.mocked(listDuesInvoices).mockImplementation(({ query }: any) => {
    if (query.status === 'sent') {
      return Promise.resolve(ok<ListDuesInvoicesResponse>({
        data: [{
          id: 'inv-sent', version: 1, createdAt: new Date(), updatedAt: new Date(),
          membershipId: 'ms1', personId: 'p1', organizationId: 'o1',
          invoiceNumber: 'INV-001', periodStart: new Date(), periodEnd: new Date(),
          totalAmount: 150000n, fundAllocations: [], status: 'sent', generatedAt: new Date(),
        }],
        pagination: PAGE1,
      }))
    }
    // status === 'overdue'
    return Promise.resolve(ok<ListDuesInvoicesResponse>({
      data: [{
        id: 'inv-overdue', version: 1, createdAt: new Date(), updatedAt: new Date(),
        membershipId: 'ms2', personId: 'p2', organizationId: 'o1',
        invoiceNumber: 'INV-002', periodStart: new Date(), periodEnd: new Date(),
        totalAmount: 200000n, fundAllocations: [], status: 'overdue', generatedAt: new Date(),
      }],
      pagination: PAGE1,
    }))
  })
  const { result } = renderHook(() => useOutstandingInvoices('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  const ids = result.current.data!.map((i: any) => i.id)
  expect(ids).toContain('inv-sent')
  expect(ids).toContain('inv-overdue')
  expect(result.current.data!.length).toBe(2)
})
