import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { PageHeader } from '@/components/patterns/page-header'
import { StatCard } from '@/components/patterns/stat-card'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { Calendar, Award, UserPlus } from 'lucide-react'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function DashboardPage() {
  const person = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  const [memberships, setMemberships] = useState<any[]>([])
  const [membershipsLoading, setMembershipsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/persons/me/memberships')
      .then(res => res.json())
      .then(res => {
        setMemberships(res?.data || [])
        setMembershipsLoading(false)
      })
      .catch(() => setMembershipsLoading(false))
  }, [])

  const displayName = person.data?.firstName ?? 'there'

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${displayName}`}
        subtitle="Your membership health at a glance"
      />

      {/* Onboarding prompt */}
      {person.data && !person.data.specialization && (
        <Link
          to="/onboarding"
          className="block rounded-[12px] border border-[var(--color-cream)] bg-[var(--color-cream-light)] p-4 mb-6 hover:border-[var(--color-cream-dark)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-[var(--color-primary)] shrink-0" />
            <div>
              <p className="text-[14px] font-semibold">Complete your profile</p>
              <p className="text-[13px] font-medium text-[var(--color-muted)]">Add your specialization and preferences</p>
            </div>
          </div>
        </Link>
      )}

      {/* Org Membership Cards */}
      <section className="mb-8">
        <h2 className="text-[16px] font-semibold font-display mb-4">Your Organizations</h2>
        {membershipsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !memberships.length ? (
          <EmptyState
            headline="No memberships yet"
            description="Join an organization to get started"
            action={{ label: 'Find Organizations', onClick: () => {} }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memberships.map((m: any) => (
              <Link
                key={m.id}
                to="/org/$orgId/members"
                params={{ orgId: m.orgId }}
                className="block rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 hover:shadow-soft transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <AvatarInitials name={m.orgName ?? 'Org'} size="md" />
                    <div>
                      <p className="text-[14px] font-semibold">{m.orgName}</p>
                      {m.memberNumber && (
                        <p className="text-[13px] font-medium text-[var(--color-muted)]">#{m.memberNumber}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={m.status ?? 'pending'} />
                </div>
                {m.duesExpiryDate && (
                  <p className="text-[13px] font-medium text-[var(--color-muted)] mt-3">
                    Dues expire: {new Date(m.duesExpiryDate).toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard label="Organizations" value={memberships.length} />
          <StatCard label="CPD Credits" value="--" />
          <StatCard label="Upcoming Events" value="--" />
          <StatCard label="Notifications" value="--" />
        </div>
      </section>

      {/* Activity placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-[var(--color-muted)]" />
            <h3 className="text-[16px] font-semibold font-display">Upcoming Events</h3>
          </div>
          <EmptyState
            headline="No upcoming events"
            description="Events you register for will appear here"
          />
        </section>

        <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-[var(--color-muted)]" />
            <h3 className="text-[16px] font-semibold font-display">Credit Progress</h3>
          </div>
          <EmptyState
            headline="No credits yet"
            description="Complete trainings and events to earn CPD credits"
          />
        </section>
      </div>
    </div>
  )
}
