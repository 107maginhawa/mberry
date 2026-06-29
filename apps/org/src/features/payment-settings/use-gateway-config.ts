import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  getDuesGatewayConfig,
  upsertDuesGatewayConfig,
  testDuesGatewayConnection,
  disconnectDuesGateway,
} from '@monobase/sdk-ts/generated'
import { friendlyApiError } from '@/lib/friendly-error'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return friendlyApiError(e)
  }
  return undefined
}

export interface GatewayStatus {
  provider?: string
  publicKey?: string
  connected?: boolean
  /** Date returned by the engine; null/undefined when never tested. */
  lastTestAt?: Date | null
}

export function useGatewayConfig(orgId: string | null) {
  const qc = useQueryClient()

  const statusQuery: UseQueryResult<GatewayStatus> = useQuery({
    queryKey: ['gateway-config', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getDuesGatewayConfig({ path: { organizationId: orgId! } })
      if (!response || !response.ok) {
        throw new Error(`Gateway status failed: ${response?.status ?? '?'}`)
      }
      return (data ?? {}) as GatewayStatus
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['gateway-config', orgId] })

  const connect = useMutation({
    mutationFn: async (vars: { publicKey: string; secretKey: string; webhookSecret?: string }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await upsertDuesGatewayConfig({
        path: { organizationId: orgId },
        body: {
          provider: 'paymongo',
          publicKey: vars.publicKey,
          secretKey: vars.secretKey,
          ...(vars.webhookSecret ? { webhookSecret: vars.webhookSecret } : {}),
        },
      })
      if (!data) throw new Error(serverError(error) ?? 'Could not save credentials.')
      return data
    },
    onSuccess: invalidate,
  })

  const test = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await testDuesGatewayConnection({ path: { organizationId: orgId } })
      if (!data) throw new Error(serverError(error) ?? 'Connection test failed.')
      return data
    },
    onSuccess: invalidate,
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error, response } = await disconnectDuesGateway({ path: { organizationId: orgId } })
      if (!response || !response.ok) throw new Error(serverError(error) ?? 'Could not disconnect.')
      return data
    },
    onSuccess: invalidate,
  })

  return { statusQuery, connect, test, disconnect }
}
