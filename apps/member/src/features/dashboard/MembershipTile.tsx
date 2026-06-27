import { Card, CardHeader, CardTitle, CardContent, StatusBadge, EmptyState, ErrorState, Skeleton } from '@monobase/ui'
import { useMemberData } from './use-member-data'

/**
 * MembershipTile — shows the member's active chapter membership.
 *
 * [review m8] duesExpiryDate comes from the DB as a plain date STRING (e.g. "2025-12-31").
 * The memberships response transformer does NOT date-convert this field (only startDate/endDate).
 * Wrap with new Date(duesExpiryDate) before formatting; guard null.
 *
 * a11y: 18px base via tokens.css, role=alert on error, one primary task.
 */
export function MembershipTile() {
  const { membershipsQuery } = useMemberData()
  const { isLoading, isError, data } = membershipsQuery

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Membership</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Could not load your membership. Please refresh." />
        </CardContent>
      </Card>
    )
  }

  const membership = data && data.length > 0 ? data[0] : null

  if (!membership) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Membership</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState headline="No active membership" description="Contact your chapter officer if you believe this is a mistake." />
        </CardContent>
      </Card>
    )
  }

  // [review m8] duesExpiryDate is a string — transformer does NOT date-convert it.
  // Wrap with new Date() before formatting, guard null.
  const renewalLabel = membership.duesExpiryDate
    ? new Date(membership.duesExpiryDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  // status must match StatusBadge's MembershipStatus union: active | grace | lapsed | pending | suspended
  const safeStatus = ['active', 'grace', 'lapsed', 'pending', 'suspended'].includes(membership.status)
    ? (membership.status as 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended')
    : 'pending'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body font-semibold text-muted-foreground">Membership</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-section font-semibold text-foreground">
          {membership.orgName ?? 'Your Chapter'}
        </p>
        <div className="flex items-center gap-3">
          <StatusBadge status={safeStatus} />
        </div>
        {renewalLabel && (
          <p className="text-body text-muted-foreground">
            <span className="font-medium">Renews</span>{' '}
            {renewalLabel}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
