import { useQuery } from '@tanstack/react-query'
import { getMyMemberships } from '@monobase/sdk-ts/generated'

export type SessionStatus = 'loading' | 'authed' | 'unauthed'

// /persons/me/memberships doubles as the auth probe: a 401 (or transport-undef)
// means no session. Officer-term gating happens later, per selected org.
export function useSession(): { status: SessionStatus } {
  const q = useQuery({
    queryKey: ['session'],
    retry: false,
    queryFn: async () => {
      const { data, response } = await getMyMemberships()
      if (!response) throw new Error('session probe failed')
      if (response.status === 401) return { authed: false as const }
      if (!data) throw new Error('session probe failed')
      return { authed: true as const, memberships: data.data }
    },
  })
  if (q.isLoading) return { status: 'loading' }
  if (q.data?.authed) return { status: 'authed' }
  return { status: 'unauthed' }
}
