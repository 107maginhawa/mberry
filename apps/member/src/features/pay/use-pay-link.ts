import { useQuery } from '@tanstack/react-query'
import { validatePaymentToken } from '@monobase/sdk-ts/generated'

export type PayState =
  | { kind: 'loading' }
  | { kind: 'payable'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'alreadyPaid' } | { kind: 'expired' } | { kind: 'invalid' }
  | { kind: 'paying' } | { kind: 'succeeded' }
  | { kind: 'cancelled'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'notConfigured' } | { kind: 'temporaryError' }

export function usePayLink(token: string): { state: PayState; pay: () => void } {
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
  let state: PayState = { kind: 'loading' }
  const d = q.data as any
  if (q.isError) state = { kind: 'temporaryError' }
  else if (d) {
    if (d.valid) state = { kind: 'payable', amount: Number(d.amount), currency: d.currency, orgName: d.orgName, memberName: d.memberName, dueDate: d.dueDate }
    else if (d.status === 'already_paid') state = { kind: 'alreadyPaid' }
    else if (typeof d.error === 'string' && /expired/i.test(d.error)) state = { kind: 'expired' }
    else state = { kind: 'invalid' }
  }
  return { state, pay: () => { /* Task 3 */ } }
}
