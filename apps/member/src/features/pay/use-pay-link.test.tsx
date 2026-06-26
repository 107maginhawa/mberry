import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@monobase/sdk-ts/generated', () => ({
  validatePaymentToken: vi.fn(),
  checkoutPaymentToken: vi.fn(),
}))
import { validatePaymentToken } from '@monobase/sdk-ts/generated'
import { usePayLink } from './use-pay-link'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)
const mockValidate = (data: unknown) => (validatePaymentToken as any).mockResolvedValue({ data })

beforeEach(() => vi.clearAllMocks())

it('maps valid → payable with amount/org/member/due', async () => {
  mockValidate({ valid: true, amount: 250000, currency: 'PHP', memberName: 'Olive Cruz', orgName: 'PDA Manila', dueDate: '2026-07-01T00:00:00.000Z' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  expect(result.current.state).toMatchObject({ amount: 250000, orgName: 'PDA Manila', memberName: 'Olive Cruz' })
})
it('maps already_paid → alreadyPaid', async () => {
  mockValidate({ valid: false, status: 'already_paid', error: 'x' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('alreadyPaid'))
})
it('maps expired-message → expired', async () => {
  mockValidate({ valid: false, error: 'This payment link has expired. ...' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('expired'))
})
it('maps other invalid → invalid', async () => {
  mockValidate({ valid: false, error: 'Payment link is invalid or has been revoked' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('invalid'))
})
