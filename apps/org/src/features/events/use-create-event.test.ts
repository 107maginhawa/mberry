import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '../../test-utils/mock-sdk'
import { useCreateEvent } from './use-create-event'

vi.mock('@monobase/sdk-ts/generated', () => ({ createEvent: vi.fn() }))
import { createEvent } from '@monobase/sdk-ts/generated'
const mockCreate = createEvent as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

const BASE = { title: 'AGM', eventType: 'assembly', startDate: '2026-09-01T01:00:00.000Z', endDate: '2026-09-01T05:00:00.000Z' }

describe('useCreateEvent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a typed body with fee as number centavos, Date objects + creditBearing false', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'e1' }, 201))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE, feePhp: 250 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const body = mockCreate.mock.calls[0]![0].body
    expect(body.organizationId).toBe('org-1')
    expect(body.title).toBe('AGM')
    expect(body.eventType).toBe('assembly')
    expect(body.creditBearing).toBe(false)
    expect(body.registrationFee).toBe(25000) // number centavos — engine validator rejects a bigint (serializes to string)
    expect(body.currency).toBe('PHP')
    expect(body.startDate).toBeInstanceOf(Date)
    expect(body.startDate.toISOString()).toBe(BASE.startDate)
    expect(body.endDate.toISOString()).toBe(BASE.endDate)
  })

  it('omits registrationFee when feePhp is blank/zero', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'e2' }, 201))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCreate.mock.calls[0]![0].body.registrationFee).toBeUndefined()
  })

  it('throws the server error message on 403', async () => {
    mockCreate.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
  })
})
