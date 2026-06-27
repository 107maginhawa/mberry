import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemberOrg } from '@/features/org/use-member-org'
import { API_BASE } from '@/lib/api'

/** Mirrors services/api-ts/src/handlers/person/utils/id-card-data.ts IdCardData (NOT in SDK). */
export interface IdCardData {
  personId: string
  firstName: string
  lastName: string | null
  licenseNumber: string | null
  organizationName: string
  membershipStatus: string
  photoUrl: string | null
  qrPayload: string
  qrSignature: string
  validUntil: string | null
  verifyCredentialNumber: string | null
}

/**
 * GET /persons/me/id-card/:orgId — un-SDK'd endpoint, raw fetch (engine FROZEN).
 * Mirrors the raw idiom in features/auth/sign-in.ts; uses API_BASE so VITE_API_URL
 * override is honored. GET → no CSRF header needed. 404 → null (no card → EmptyState).
 */
export function useIdCard(): UseQueryResult<IdCardData | null> {
  const { orgId } = useMemberOrg()
  return useQuery({
    queryKey: ['id-card', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/persons/me/id-card/${orgId}`, { credentials: 'include' })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`ID card fetch failed: ${res.status}`)
      const body = (await res.json()) as { data: IdCardData }
      return body.data
    },
  })
}
