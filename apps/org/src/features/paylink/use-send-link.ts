import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { sendPaymentLink, revokePaymentLink } from '@monobase/sdk-ts/generated'

export type SendState =
  | { kind: 'idle' }
  | { kind: 'minting' }
  | { kind: 'sent'; url: string; tokenId: string; expiresAt: string }
  | { kind: 'error'; message: string }
  | { kind: 'revoked' }

export function useSendLink(
  orgId: string,
  personId: string,
): {
  state: SendState
  mint: (args: { amount: number; invoiceId?: string }) => void
  revoke: () => void
} {
  const [tokenId, setTokenId] = useState<string | null>(null)
  // Synchronous guard: isPending from React Query doesn't update within the same act() frame,
  // so we track the in-flight state with a ref to block double-submits.
  const mintingRef = useRef(false)

  const mintM = useMutation<SendState, Error, { amount: number; invoiceId?: string }>({
    mutationFn: async ({ amount, invoiceId }) => {
      const { data, error, response: rawResponse } = await sendPaymentLink({
        path: { organizationId: orgId },
        // SendPaymentLinkRequest.amount is typed `bigint?` — coerce at the SDK seam.
        body: { personId, amount: BigInt(amount), ...(invoiceId ? { invoiceId } : {}) },
      })
      // SDK returns { data, error, response } and does NOT throw on non-2xx.
      const response = rawResponse as Response
      if (response.status === 201 && data) {
        return {
          kind: 'sent',
          url: `${window.location.origin}${data.paymentUrl}`,
          tokenId: data.token,
          expiresAt: data.expiresAt,
        }
      }
      const serverMsg = (error as any)?.error ?? (error as any)?.message ?? (data as any)?.error
      const msg = typeof serverMsg === 'string'
        ? serverMsg
        : response.status === 403
          ? 'You are not an officer of this organization.'
          : 'Could not create the pay-link.'
      throw new Error(msg)
    },
    onSuccess: (s) => {
      if (s.kind === 'sent') setTokenId(s.tokenId)
    },
  })

  const revokeM = useMutation<SendState, Error>({
    mutationFn: async () => {
      const { data, error, response: rawResponse } = await revokePaymentLink({
        path: { organizationId: orgId, tokenId: tokenId! },
      })
      // SDK returns { data, error, response } and does NOT throw on non-2xx.
      const response = rawResponse as Response
      // 404 = already used/revoked → treat as revoked (idempotent UX).
      if (response.status === 200 || response.status === 404) return { kind: 'revoked' }
      throw new Error((error as any)?.error ?? (error as any)?.message ?? (data as any)?.error ?? 'Could not revoke the link.')
    },
  })

  let state: SendState = { kind: 'idle' }
  if (revokeM.isSuccess) state = { kind: 'revoked' }
  else if (mintM.isPending) state = { kind: 'minting' }
  else if (mintM.isError) state = { kind: 'error', message: mintM.error.message }
  else if (mintM.isSuccess) state = mintM.data

  return {
    state,
    mint: (args) => {
      if (mintingRef.current || mintM.isPending) return
      mintingRef.current = true
      revokeM.reset()
      mintM.mutate(args, { onSettled: () => { mintingRef.current = false } })
    },
    revoke: () => {
      if (!tokenId || revokeM.isPending) return
      revokeM.mutate()
    },
  }
}
