import { useQuery } from '@tanstack/react-query'
import { getMyMemberships } from '@monobase/sdk-ts/generated'

export type SessionStatus = 'loading' | 'authed' | 'unauthed'

// Drift field: the handler returns organizationId on each membership object but the
// generated SDK MyMembership type may omit it. Anchor test mocks to the handler shape
// and cast to this type. Never bind the lying generated type for this field.
export type RawMembership = { organizationId: string; [key: string]: unknown }

/**
 * Probe the session via getMyMemberships. A 401 (or transport undefined) → unauthed.
 *
 * [review m7] `enabled` param (default true) lets the root guard skip the probe on
 * public paths (/sign-in, /pay/*). When disabled, returns status:'loading' so the
 * RootGate short-circuits public paths to <Outlet/> without ever touching the session
 * endpoint.
 */
export function useSession(enabled = true): {
  status: SessionStatus
  memberships?: RawMembership[]
} {
  const q = useQuery({
    queryKey: ['session'],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getMyMemberships()
      if (!response) throw new Error('session probe failed')
      if (response.status === 401) return { authed: false as const }
      if (!data) throw new Error('session probe failed')
      return { authed: true as const, memberships: data.data as RawMembership[] }
    },
  })
  // Explicit !enabled guard: TQ v5 isLoading = isPending && isFetching, which is
  // false when disabled (not fetching). We must return 'loading' for public paths.
  if (!enabled || q.isLoading) return { status: 'loading' }
  if (q.data?.authed) return { status: 'authed', memberships: q.data.memberships }
  return { status: 'unauthed' }
}
