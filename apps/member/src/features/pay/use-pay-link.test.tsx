import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@monobase/sdk-ts/generated', () => ({
  validatePaymentToken: vi.fn(),
  checkoutPaymentToken: vi.fn(),
}))
import { validatePaymentToken, checkoutPaymentToken } from '@monobase/sdk-ts/generated'
import { usePayLink } from './use-pay-link'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)
const mockValidate = (data: unknown) => (validatePaymentToken as any).mockResolvedValue({ data })

beforeEach(() => vi.clearAllMocks())

it('maps valid → payable with amount/org/member/due', async () => {
  mockValidate({ valid: true, amount: 250000n, currency: 'PHP', memberName: 'Olive Cruz', orgName: 'PDA Manila', dueDate: '2026-07-01T00:00:00.000Z' })
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

// ── checkout-side tests (Task 3) ──────────────────────────────────────────────

const mockCheckout = (status: number, data: unknown) =>
  (checkoutPaymentToken as any).mockResolvedValue({ data, response: { status } })

it('200 → navigates to checkoutUrl', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(200, { checkoutUrl: 'https://pm.test/cs_1' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  act(() => result.current.pay())
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://pm.test/cs_1'))
})

it('202 then 200 → retries then navigates', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  ;(checkoutPaymentToken as any)
    .mockResolvedValueOnce({ data: { checkoutUrl: '' }, response: { status: 202 } })
    .mockResolvedValueOnce({ data: { checkoutUrl: 'https://pm.test/cs_1' }, response: { status: 200 } })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))

  vi.useFakeTimers()
  try {
    act(() => result.current.pay())
    await act(() => vi.advanceTimersByTimeAsync(1600))
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('https://pm.test/cs_1')
  } finally {
    vi.useRealTimers()
  }
})

it('400 → notConfigured', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(400, { error: 'PayMongo not configured' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  act(() => result.current.pay())
  await waitFor(() => expect(result.current.state.kind).toBe('notConfigured'))
})

it('409 → alreadyPaid', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(409, { error: 'This payment has already been processed' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  act(() => result.current.pay())
  await waitFor(() => expect(result.current.state.kind).toBe('alreadyPaid'))
})

it('410 → expired (message has expired) else invalid', async () => {
  // Case 1: expired message → expired
  {
    mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
    mockCheckout(410, { error: 'This payment link has expired. Please request a new one.' })
    const navigate = vi.fn()
    const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
    await waitFor(() => expect(result.current.state.kind).toBe('payable'))
    act(() => result.current.pay())
    await waitFor(() => expect(result.current.state.kind).toBe('expired'))
  }
  // Case 2: revoked (non-expired) → invalid
  vi.clearAllMocks()
  {
    mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
    mockCheckout(410, { error: 'This payment link was revoked' })
    const navigate = vi.fn()
    const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
    await waitFor(() => expect(result.current.state.kind).toBe('payable'))
    act(() => result.current.pay())
    await waitFor(() => expect(result.current.state.kind).toBe('invalid'))
  }
})

it('502 → temporaryError', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(502, { error: 'Failed to create checkout session. Please try again.' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  act(() => result.current.pay())
  await waitFor(() => expect(result.current.state.kind).toBe('temporaryError'))
})

it('double-tap guard — second pay() while in-flight is a no-op', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  // Use a hanging promise so the mutation stays in-flight long enough to test the guard.
  let resolveCheckout!: (v: unknown) => void
  ;(checkoutPaymentToken as any).mockImplementation(
    () => new Promise(r => { resolveCheckout = r })
  )
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))

  // First call — mutation enters pending (isPending=true after React flushes the update).
  act(() => result.current.pay())
  // result.current now reflects the re-rendered hook (isPending===true);
  // second call must be a no-op.
  await waitFor(() => expect(result.current.state.kind).toBe('paying'))
  act(() => result.current.pay())

  // Resolve the single in-flight request and confirm only one request was made.
  await act(async () => { resolveCheckout({ data: { checkoutUrl: 'https://pm.test/cs_1' }, response: { status: 200 } }) })
  await waitFor(() => expect(navigate).toHaveBeenCalled())
  expect(checkoutPaymentToken).toHaveBeenCalledTimes(1)
})

// ── returnStatus tests (Task 4) ──────────────────────────────────────────────

describe('returnStatus handling', () => {
  it('cancelled + valid validate → cancelled carrying payable fields', async () => {
    mockValidate({ valid: true, amount: 500000n, currency: 'PHP', memberName: 'Olive Cruz', orgName: 'PDA Manila', dueDate: '2026-07-01T00:00:00.000Z' })
    const { result } = renderHook(
      () => usePayLink('tok', { returnStatus: 'cancelled' }),
      { wrapper }
    )
    // Wait until validate resolves and the state carries the payable fields.
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        kind: 'cancelled',
        amount: 500000,
        currency: 'PHP',
        orgName: 'PDA Manila',
        memberName: 'Olive Cruz',
        dueDate: '2026-07-01T00:00:00.000Z',
      })
    )
  })

  it('cancelled + validate still loading → cancelled (no payable fields yet)', async () => {
    // validate resolves after a delay — hook should still land on cancelled immediately
    ;(validatePaymentToken as any).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(
      () => usePayLink('tok', { returnStatus: 'cancelled' }),
      { wrapper }
    )
    // Should be cancelled even before validate resolves
    await waitFor(() => expect(result.current.state.kind).toBe('cancelled'))
  })

  it('success + valid validate → succeeded (success wins)', async () => {
    mockValidate({ valid: true, amount: 500000n, currency: 'PHP', memberName: 'Olive Cruz', orgName: 'PDA Manila', dueDate: '2026-07-01T00:00:00.000Z' })
    const { result } = renderHook(
      () => usePayLink('tok', { returnStatus: 'success' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.state.kind).toBe('succeeded'))
  })

  it('success + already_paid validate → succeeded (success still wins)', async () => {
    mockValidate({ valid: false, status: 'already_paid', error: 'x' })
    const { result } = renderHook(
      () => usePayLink('tok', { returnStatus: 'success' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.state.kind).toBe('succeeded'))
  })
})

it('202 exhausted (3 calls) → temporaryError, never navigates', async () => {
  // CHECKOUT_MAX_RETRIES=3: attempt 1 (202, delay), attempt 2 (202, delay), attempt 3 (202, retries>=3 → exit)
  // = 3 total checkoutPaymentToken calls, 2×1500ms delays = 3000ms total.
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(202, { checkoutUrl: '' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))

  vi.useFakeTimers()
  try {
    act(() => result.current.pay())
    // Advance past both retry delays (2 × 1500ms)
    await act(() => vi.advanceTimersByTimeAsync(3100))
  } finally {
    vi.useRealTimers()
  }

  await waitFor(() => expect(result.current.state.kind).toBe('temporaryError'))
  expect(checkoutPaymentToken).toHaveBeenCalledTimes(3)
  expect(navigate).not.toHaveBeenCalled()
})
