import { it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getDuesDashboard: vi.fn(), listDuesPayments: vi.fn(), listDuesInvoices: vi.fn() }))
import { getDuesDashboard, listDuesPayments, listDuesInvoices } from '@monobase/sdk-ts/generated'
import { useDuesDashboard, useRecentPayments, useOutstandingInvoices } from './use-dues'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

it('useDuesDashboard coerces money fields to number and exposes collectionRate+memberCount', async () => {
  // Ground-truth handler shape: plain numbers, WITH collectionRate+memberCount, NO upcomingActivities
  ;(getDuesDashboard as any).mockResolvedValue({
    data: {
      data: {
        totalCollected: 250000,
        totalOutstanding: 500000,
        paidCount: 1,
        unpaidCount: 2,
        overdueCount: 0,
        collectionRate: 33,
        memberCount: 3,
      },
    },
    response: new Response('', { status: 200 }),
  } as any)
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
  ;(getDuesDashboard as any).mockResolvedValue({
    data: { data: { totalCollected: 0, totalOutstanding: 0, paidCount: 2, unpaidCount: 3, overdueCount: 1 } },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  // memberCount fallback = paidCount + unpaidCount + overdueCount = 6
  expect(result.current.data!.memberCount).toBe(6)
  // collectionRate fallback = round(2/6 * 100) = 33
  expect(result.current.data!.collectionRate).toBe(33)
})

// ─── Payments ────────────────────────────────────────────────────────────────

it('useRecentPayments coerces amount + refundedAmount to number', async () => {
  ;(listDuesPayments as any).mockResolvedValue({
    data: { data: [{ id: 'p1', amount: 100000n, refundedAmount: 0n, status: 'completed' }], totalCount: 1 },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useRecentPayments('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(100000)
  expect(typeof result.current.data![0].amount).toBe('number')
  expect(typeof (result.current.data![0] as any).refundedAmount).toBe('number')
})

// ─── Invoices ────────────────────────────────────────────────────────────────

it('useOutstandingInvoices maps totalAmount→amount (CRIT-1: invoice has no amount field)', async () => {
  // Ground-truth handler shape: field is `totalAmount`, NOT `amount`
  ;(listDuesInvoices as any).mockResolvedValue({
    data: {
      data: [{ id: 'inv1', totalAmount: 200000n, status: 'sent', memberName: 'Olive Cruz' }],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
    },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useOutstandingInvoices('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(200000)
  // Proves the fix: with old code (i.amount) this would be NaN
  expect(isFinite(result.current.data![0].amount)).toBe(true)
  expect(typeof result.current.data![0].amount).toBe('number')
})

it('useOutstandingInvoices IMP-2: includes both sent AND overdue invoices', async () => {
  // Hook makes two calls — use mockImplementation to route by status param
  ;(listDuesInvoices as any).mockImplementation(({ query }: any) => {
    if (query.status === 'sent') {
      return Promise.resolve({
        data: {
          data: [{ id: 'inv-sent', totalAmount: 150000n, status: 'sent', memberName: 'Olive Cruz' }],
        },
        response: new Response('', { status: 200 }),
      })
    }
    // status === 'overdue'
    return Promise.resolve({
      data: {
        data: [{ id: 'inv-overdue', totalAmount: 200000n, status: 'overdue', memberName: 'Juan dela Cruz' }],
      },
      response: new Response('', { status: 200 }),
    })
  })
  const { result } = renderHook(() => useOutstandingInvoices('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  const ids = result.current.data!.map((i: any) => i.id)
  expect(ids).toContain('inv-sent')
  expect(ids).toContain('inv-overdue')
  expect(result.current.data!.length).toBe(2)
})
