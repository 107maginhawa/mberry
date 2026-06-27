import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { mintMyPaymentLink, type SendPaymentLinkResponse } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

/**
 * Extract a human-readable error string from a hey-api error envelope
 * (no-throw style: {data, error} — error is the raw response body).
 */
function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

/**
 * usePayNow — useMutation wrapper for mintMyPaymentLink (self-serve pay-link).
 *
 * Calls POST /org/{organizationId}/payments/mint-mine with the member's own
 * invoiceId. Returns SendPaymentLinkResponse {token, paymentUrl, expiresAt}.
 * Throws on missing orgId or API error (no-throw SDK style: checks !data).
 */
export function usePayNow(): UseMutationResult<SendPaymentLinkResponse, Error, { invoiceId: string }> {
  const { orgId } = useMemberOrg()
  return useMutation<SendPaymentLinkResponse, Error, { invoiceId: string }>({
    mutationFn: async ({ invoiceId }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await mintMyPaymentLink({
        path: { organizationId: orgId },
        body: { invoiceId },
      })
      if (!data) throw new Error(serverError(error) ?? 'Could not start payment. Please try again.')
      return data as SendPaymentLinkResponse
    },
  })
}
