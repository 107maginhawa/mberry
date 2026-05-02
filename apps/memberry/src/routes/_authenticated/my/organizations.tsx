import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { Building2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/organizations')({
  component: MyOrganizationsPage,
})

function MyOrganizationsPage() {
  const [memberships, setMemberships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/persons/me/memberships')
      .then(res => res.json())
      .then(res => {
        setMemberships(res?.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title="Organizations"
        subtitle="Your memberships across all organizations"
        actions={
          <button className="px-[22px] py-[10px] rounded-[8px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150">
            Find Organizations
          </button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : !memberships.length ? (
        <EmptyState
          icon={<Building2 size={40} />}
          headline="No memberships yet"
          description="Join a professional organization to access events, training, and credentials"
          action={{ label: 'Find Organizations', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {memberships.map((m: any) => (
            <Link
              key={m.id}
              to="/org/$orgId/members"
              params={{ orgId: m.orgId }}
              className="flex items-center gap-4 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 hover:shadow-soft transition-shadow"
            >
              <AvatarInitials name={m.orgName ?? 'Org'} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate">{m.orgName}</p>
                <div className="flex items-center gap-2 mt-1">
                  {m.memberNumber && (
                    <span className="text-[13px] font-medium text-[var(--color-muted)]">#{m.memberNumber}</span>
                  )}
                </div>
                {m.duesExpiryDate && (
                  <p className="text-[13px] font-medium text-[var(--color-muted)] mt-1">
                    Dues expire: {new Date(m.duesExpiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={m.status ?? 'pending'} />
                {(m.status === 'grace' || m.status === 'lapsed' || m.status === 'gracePeriod') && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                    className="px-4 py-[7px] rounded-[8px] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-mid)] transition-colors duration-150"
                  >
                    Pay Dues
                  </button>
                )}
              </div>
            </Link>
          ))}

          <p className="text-[13px] font-medium text-[var(--color-muted)] text-center mt-4">
            Each organization manages its own membership, dues, and credits independently.
          </p>
        </div>
      )}
    </div>
  )
}
