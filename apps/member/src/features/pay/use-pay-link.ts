import { useQuery, useMutation } from '@tanstack/react-query'
import { validatePaymentToken, checkoutPaymentToken } from '@monobase/sdk-ts/generated'

export type PayState =
  | { kind: 'loading' }
  | { kind: 'payable'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'alreadyPaid' } | { kind: 'expired' } | { kind: 'invalid' }
  | { kind: 'paying' } | { kind: 'succeeded' }
  | { kind: 'cancelled'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'notConfigured' } | { kind: 'temporaryError' }

const CHECKOUT_MAX_RETRIES = 3
const CHECKOUT_RETRY_DELAY_MS = 1500

export function usePayLink(
  token: string,
  {
    navigate = (url: string) => window.location.assign(url),
    returnStatus,
  }: { navigate?: (url: string) => void; returnStatus?: 'success' | 'cancelled' } = {}
): { state: PayState; pay: () => void } {
  const q = useQuery({
    queryKey: ['pay-validate', token],
    // SDK does NOT throw on non-2xx and returns data:undefined on transport error.
    // Throw so a network failure surfaces as an error (→ temporaryError) instead of
    // resolving undefined and hanging on `loading` forever (I3).
    queryFn: async () => {
      const { data } = await validatePaymentToken({ path: { token } })
      if (!data) throw new Error('validate failed')
      return data
    },
  })

  const mutation = useMutation<PayState, Error>({
    mutationFn: async (): Promise<PayState> => {
      let retries = 0
      // Plain async loop: retry logic lives entirely in the mutationFn so
      // fake-timer tests can advance past the ~1500ms delay without fighting
      // React Query's internal retry mechanics.
      while (true) {
        const { data, response } = await checkoutPaymentToken({ path: { token } })
        // SDK returns { data, response } and does NOT throw on non-2xx.
        const status = (response as Response).status
        const errMsg = typeof (data as any)?.error === 'string' ? (data as any).error as string : ''

        if (status === 200) {
          navigate((data as any).checkoutUrl as string)
          return { kind: 'succeeded' }
        }
        if (status === 202) {
          retries++
          if (retries >= CHECKOUT_MAX_RETRIES) return { kind: 'temporaryError' }
          // Bounded: at most CHECKOUT_MAX_RETRIES attempts before giving up.
          await new Promise<void>(r => setTimeout(r, CHECKOUT_RETRY_DELAY_MS))
          continue
        }
        if (status === 400) return { kind: 'notConfigured' }
        if (status === 409) return { kind: 'alreadyPaid' }
        if (status === 410) return /expired/i.test(errMsg) ? { kind: 'expired' } : { kind: 'invalid' }
        // 502 or any unexpected status → transient error, retryable
        return { kind: 'temporaryError' }
      }
    },
  })

  // State resolution: returnStatus (gateway redirect) takes top precedence,
  // then checkout-side once pay() is invoked, then validate-side.
  let state: PayState = { kind: 'loading' }

  if (returnStatus === 'success') {
    // User returned from the payment gateway with a success signal — trust it.
    state = { kind: 'succeeded' }
  } else if (returnStatus === 'cancelled') {
    // User returned after cancelling — show cancelled screen. Reuse payable
    // fields from validate when available so the Pay-again affordance can
    // display the amount/org/member/due.
    const d = q.data as any
    const payableFields = d?.valid
      ? { amount: Number(d.amount), currency: d.currency as string, orgName: d.orgName as string, memberName: d.memberName as string, dueDate: d.dueDate as string }
      : { amount: 0, currency: '', orgName: '', memberName: '', dueDate: '' }
    state = { kind: 'cancelled', ...payableFields }
  } else if (mutation.isPending) {
    state = { kind: 'paying' }
  } else if (mutation.isSuccess && mutation.data) {
    state = mutation.data
  } else if (mutation.isError) {
    state = { kind: 'temporaryError' }
  } else {
    // Validate-side mapping (pre-pay states — Task 2, unchanged)
    const d = q.data as any
    if (q.isError) state = { kind: 'temporaryError' }
    else if (d) {
      if (d.valid) state = { kind: 'payable', amount: Number(d.amount), currency: d.currency, orgName: d.orgName, memberName: d.memberName, dueDate: d.dueDate }
      else if (d.status === 'already_paid') state = { kind: 'alreadyPaid' }
      else if (typeof d.error === 'string' && /expired/i.test(d.error)) state = { kind: 'expired' }
      else state = { kind: 'invalid' }
    }
  }

  return { state, pay: () => { if (mutation.isPending) return; mutation.mutate() } }
}
