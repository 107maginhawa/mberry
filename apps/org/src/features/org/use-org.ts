import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { getMyMemberships, getMyOfficerRole } from '@monobase/sdk-ts/generated'

const STORAGE_KEY = 'org.selectedOrgId'

type Org = { id: string; name: string }

// F2: stable empty reference — avoids triggering useEffect([orgId, orgs]) on every render during loading
const EMPTY_ORGS: Org[] = []

function useMembershipOrgs() {
  return useQuery({
    queryKey: ['org', 'memberships'],
    retry: false,
    queryFn: async () => {
      const { data } = await getMyMemberships()
      if (!data) throw new Error('memberships failed')
      // The engine returns more fields than the generated MyMembership type declares
      // (orgName, orgSlug, total are present at runtime but absent from the type).
      const seen = new Map<string, Org>()
      for (const m of data.data as unknown as Array<{ organizationId: string; orgName: string }>) {
        if (!seen.has(m.organizationId)) seen.set(m.organizationId, { id: m.organizationId, name: m.orgName })
      }
      return [...seen.values()]
    },
  })
}

export function useOrgs(): { status: 'loading' | 'ready' | 'empty'; orgs: Org[] } {
  const q = useMembershipOrgs()
  if (q.isLoading) return { status: 'loading', orgs: EMPTY_ORGS }
  const orgs = q.data ?? []
  return { status: orgs.length === 0 ? 'empty' : 'ready', orgs }
}

export function useSelectedOrg(): { orgId: string | null; setOrgId: (id: string) => void } {
  const { orgs } = useOrgs()
  const [orgId, setOrgIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  // F5: stale stored orgId recovery — clear if the stored org is no longer in the list.
  // Guard: only when orgId is set, orgs are loaded (length > 0), and orgId not found.
  // Avoids loops: only fires when orgId non-null AND orgs non-empty AND not found.
  useEffect(() => {
    if (orgId && orgs.length > 0 && !orgs.some(o => o.id === orgId)) {
      localStorage.removeItem(STORAGE_KEY)
      setOrgIdState(null)
    }
  }, [orgId, orgs])

  // Auto-select when there's exactly one org and nothing chosen yet.
  useEffect(() => {
    const only = orgs[0]
    if (!orgId && orgs.length === 1 && only) {
      setOrgIdState(only.id)
      localStorage.setItem(STORAGE_KEY, only.id)
    }
  }, [orgId, orgs])

  // F3: memoized — consumers can safely put setOrgId in useEffect dep arrays.
  const setOrgId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setOrgIdState(id)
  }, [])

  return { orgId, setOrgId }
}

export function useIsOfficer(orgId: string | null): { status: 'loading' | 'officer' | 'notOfficer' } {
  const q = useQuery({
    queryKey: ['org', 'officer-role', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // VERIFIED: path key is `organizationId`, url /persons/me/officer-role/{organizationId}.
      const { data } = await getMyOfficerRole({ path: { organizationId: orgId! } })
      if (!data) throw new Error('officer-role failed')
      return data
    },
  })
  if (!orgId || q.isLoading) return { status: 'loading' }
  // Engine type/impl drift: the generated type says { data: { isOfficer, positions } }
  // but the live handler returns { data: terms[] } (empty array = not an officer).
  // Handle both: non-empty array OR isOfficer:true. (Engine FROZEN — cannot fix upstream.)
  const d = q.data?.data as unknown
  const isOfficer = Array.isArray(d) ? d.length > 0 : (d as { isOfficer?: boolean } | null | undefined)?.isOfficer === true
  return { status: isOfficer ? 'officer' : 'notOfficer' }
}
