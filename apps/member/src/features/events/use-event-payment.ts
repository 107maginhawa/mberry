import { useMutation } from '@tanstack/react-query'
import { registerAndPayForEventViaPaymongo } from '@monobase/sdk-ts/generated'

/**
 * Register + pay for a paid event via the org's PayMongo connected account. Returns the PayMongo
 * checkout URL; the caller redirects the member to it. The registration settles to paid when the
 * PayMongo webhook fires. Anchored to the handler `{ data: { checkoutUrl, registrationId } }` shape.
 */
export function useRegisterAndPay() {
  return useMutation<{ checkoutUrl: string; registrationId: string }, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      const { data, error, response } = await registerAndPayForEventViaPaymongo({ path: { eventId } })
      const status = (response as Response | undefined)?.status
      if (status === 403) throw new Error('Active membership required to register for this event.')
      const body = ((data as any)?.data ?? data) as { checkoutUrl?: string; registrationId?: string } | undefined
      if (!body?.checkoutUrl) throw new Error((error as any)?.error ?? 'Could not start the payment. Please try again.')
      return { checkoutUrl: body.checkoutUrl, registrationId: body.registrationId ?? '' }
    },
  })
}
