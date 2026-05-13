import { useQuery } from '@tanstack/react-query'
import { listMembershipsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3 font-medium">Member #</th>
            <th className="px-4 py-3 font-medium">Person</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Tier</th>
            <th className="px-4 py-3 font-medium">Dues Expiry</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((m: any) => (
            <tr key={m.id} className="border-b hover:bg-[var(--color-surface-warm)]">
              <td className="px-4 py-3 font-mono text-xs">{m.memberNumber || '—'}</td>
              <td className="px-4 py-3">{m.personId}</td>
              <td className="px-4 py-3">
                <StatusBadge status={m.status} />
              </td>
              <td className="px-4 py-3">{m.tierId}</td>
              <td className="px-4 py-3">{m.duesExpiryDate || '—'}</td>
              <td className="px-4 py-3">
                {isRenewable(m.status) && (
                  <button className="text-xs text-[var(--color-primary)] hover:underline">Renew</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
