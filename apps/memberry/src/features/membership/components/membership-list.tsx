import { useQuery } from '@tanstack/react-query'
import { listMembershipsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { getStatusLabel, getStatusColor, isRenewable, type MembershipStatus } from '../lib/membership-status'

interface MembershipListProps {
  orgId: string
  tenantId: string
}

export function MembershipList({ orgId, tenantId }: MembershipListProps) {
  const { data, isLoading, error } = useQuery({
    ...listMembershipsOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': tenantId },
    }),
  })

  if (isLoading) {
    return <div className="p-6 text-center text-[var(--color-muted)]">Loading roster...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-[var(--color-error)]">Failed to load roster</div>
  }

  const memberships = (data as any)?.data ?? []

  if (memberships.length === 0) {
    return (
      <div className="p-6 text-center text-[var(--color-muted)]">
        No members yet. Start by creating membership tiers and inviting members.
      </div>
    )
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="px-4 py-3">Member #</TableHead>
          <TableHead className="px-4 py-3">Person</TableHead>
          <TableHead className="px-4 py-3">Status</TableHead>
          <TableHead className="px-4 py-3">Tier</TableHead>
          <TableHead className="px-4 py-3">Dues Expiry</TableHead>
          <TableHead className="px-4 py-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {memberships.map((m: any) => (
          <TableRow key={m.id} className="hover:bg-[var(--color-surface-warm)]">
            <TableCell className="px-4 py-3 font-mono text-xs">{m.memberNumber || '—'}</TableCell>
            <TableCell className="px-4 py-3">{m.personId}</TableCell>
            <TableCell className="px-4 py-3">
              <StatusBadge status={m.status} />
            </TableCell>
            <TableCell className="px-4 py-3">{m.tierId}</TableCell>
            <TableCell className="px-4 py-3">{m.duesExpiryDate || '—'}</TableCell>
            <TableCell className="px-4 py-3">
              {isRenewable(m.status) && (
                <Button variant="link" size="sm" className="text-xs text-[var(--color-primary)]">Renew</Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  const color = getStatusColor(status)
  const label = getStatusLabel(status)

  const colorClasses: Record<string, string> = {
    green: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    yellow: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    blue: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    gray: 'bg-gray-100 text-gray-800',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color] || colorClasses.gray}`}>
      {label}
    </span>
  )
}
