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

it('coerces bigint money fields to number', async () => {
  ;(getDuesDashboard as any).mockResolvedValue({
    data: { data: { totalCollected: 250000n, totalOutstanding: 500000n, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 } },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data!.totalCollected).toBe(250000)
  expect(typeof result.current.data!.totalCollected).toBe('number')
  expect(result.current.data!.totalOutstanding).toBe(500000)
  expect(typeof result.current.data!.totalOutstanding).toBe('number')
  expect(result.current.data!.collectionRate).toBe(33)
})

it('useRecentPayments coerces amount to number', async () => {
  ;(listDuesPayments as any).mockResolvedValue({
    data: { data: [{ id: 'p1', amount: 100000n, status: 'completed' }], totalCount: 1 },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useRecentPayments('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(100000)
  expect(typeof result.current.data![0].amount).toBe('number')
})

it('useOutstandingInvoices coerces amount to number', async () => {
  ;(listDuesInvoices as any).mockResolvedValue({
    data: { data: [{ id: 'i1', amount: 200000n, status: 'sent', memberName: 'Olive Cruz' }] },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useOutstandingInvoices('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data![0].amount).toBe(200000)
  expect(typeof result.current.data![0].amount).toBe('number')
})
