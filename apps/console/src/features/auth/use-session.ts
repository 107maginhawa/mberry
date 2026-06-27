import { useQuery } from '@tanstack/react-query'
import { listOrganizations } from '@monobase/sdk-ts/generated'

export type SessionStatus = 'loading' | 'authed' | 'unauthed' | 'forbidden'

// listOrganizations (a /admin/* endpoint) doubles as the auth+authz probe:
// 200 = authed platform admin, 401 = signed out, 403 = signed in but not a
// platform admin (no platform_admin table row).
export function useSession(): { status: SessionStatus } {
  const q = useQuery({
    queryKey: ['session'],
    retry: false,
    queryFn: async () => {
      const { response } = await listOrganizations({ query: { limit: 1 } })
      if (!response) throw new Error('session probe failed')
      if (response.status === 401) return { state: 'unauthed' as const }
      if (response.status === 403) return { state: 'forbidden' as const }
      if (response.status >= 200 && response.status < 300) return { state: 'authed' as const }
      throw new Error(`session probe failed: ${response.status}`)
    },
  })
  if (q.isLoading) return { status: 'loading' }
  if (q.data?.state) return { status: q.data.state }
  return { status: 'unauthed' }
}
