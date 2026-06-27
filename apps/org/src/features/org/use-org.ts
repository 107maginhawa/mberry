import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getMyMemberships, getMyOfficerRole } from '@monobase/sdk-ts/generated'

const STORAGE_KEY = 'org.selectedOrgId'

type Org = { id: string; name: string }

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
  if (q.isLoading) return { status: 'loading', orgs: [] }
  const orgs = q.data ?? []
  return { status: orgs.length === 0 ? 'empty' : 'ready', orgs }
}

export function useSelectedOrg(): { orgId: string | null; setOrgId: (id: string) => void } {
  const { orgs } = useOrgs()
  const [orgId, setOrgIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  // Auto-select when there's exactly one org and nothing chosen yet.
  useEffect(() => {
    const only = orgs[0]
    if (!orgId && orgs.length === 1 && only) {
      setOrgIdState(only.id)
      localStorage.setItem(STORAGE_KEY, only.id)
    }
  }, [orgId, orgs])

  const setOrgId = (id: string) => { localStorage.setItem(STORAGE_KEY, id); setOrgIdState(id) }
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
  // VERIFIED: OfficerRoleResponse = { data: { isOfficer: boolean; positions: [] } }.
  // Read the boolean directly — `q.data.data` is always a non-null object, so a
  // truthiness/array check would make the gate a no-op (always "officer").
  const isOfficer = q.data?.data?.isOfficer === true
  return { status: isOfficer ? 'officer' : 'notOfficer' }
}
