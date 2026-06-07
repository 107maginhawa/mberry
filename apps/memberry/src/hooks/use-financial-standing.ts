import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type FinancialStanding = 'good' | 'overdue' | 'suspended' | 'unknown'

interface StandingResult {
  standing: FinancialStanding
  isGoodStanding: boolean
  isOverdue: boolean
  isSuspended: boolean
  isLoading: boolean
  daysOverdue: number | null
  outstandingBalance: number
}

/**
 * Check financial standing for the current user in an organization.
 * Returns standing status that can be used to gate features like
 * event registration, governance voting, and certificate downloads.
 */
export function useFinancialStanding(orgId: string): StandingResult {
  const { data, isLoading } = useQuery({
    queryKey: ['my-financial-standing', orgId],
    queryFn: async () => {
      // Get membership status
      const membershipRes = await api.get<any>('/api/persons/me/memberships')
      const memberships = membershipRes?.data ?? []
      const membership = memberships.find((m: any) => (m.orgId ?? m.organizationId) === orgId)

      if (!membership) return { standing: 'unknown' as const, daysOverdue: null, outstandingBalance: 0 }

      const status = membership.status
      const expiryDate = membership.duesExpiryDate ? new Date(membership.duesExpiryDate) : null
      const now = new Date()
      const daysOverdue = expiryDate ? Math.max(0, Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24))) : null

      if (status === 'suspended' || status === 'expelled') {
        return { standing: 'suspended' as const, daysOverdue, outstandingBalance: 0 }
      }

      if (status === 'lapsed' || status === 'expired' || (daysOverdue !== null && daysOverdue > 0)) {
        return { standing: 'overdue' as const, daysOverdue, outstandingBalance: 0 }
      }

      return { standing: 'good' as const, daysOverdue: 0, outstandingBalance: 0 }
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })

  const standing = data?.standing ?? 'unknown'

  return {
    standing,
    isGoodStanding: standing === 'good',
    isOverdue: standing === 'overdue',
    isSuspended: standing === 'suspended',
    isLoading,
    daysOverdue: data?.daysOverdue ?? null,
    outstandingBalance: data?.outstandingBalance ?? 0,
  }
}
