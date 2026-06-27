import { useSession } from '@/features/auth/use-session'

/**
 * [review I6] REACTIVELY subscribe to session memberships via useSession() so that
 * when the query resolves the component re-renders and orgId flips null → set,
 * re-enabling downstream dues queries.
 *
 * Auto-selects a single membership's organizationId into member.selectedOrgId.
 * Exposes select(id) for the >1 membership case (org-picker UI).
 *
 * NOTE: memberships[0].organizationId is a DRIFT field — the handler returns it
 * but the generated SDK MyMembership type may omit it. Test mocks cast to handler
 * shape with a comment rather than binding the lying type.
 */
export function useMemberOrg() {
  const { memberships } = useSession() // reactive subscription — NOT a one-shot localStorage read
  const stored = localStorage.getItem('member.selectedOrgId')
  const first = memberships && memberships.length > 0 ? memberships[0] : null
  const orgId = stored ?? (first ? first.organizationId : null)
  if (orgId && orgId !== stored) localStorage.setItem('member.selectedOrgId', orgId)
  return {
    orgId,
    memberships: memberships ?? [],
    select: (id: string) => localStorage.setItem('member.selectedOrgId', id),
  }
}
