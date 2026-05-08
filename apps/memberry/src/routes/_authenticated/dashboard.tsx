import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions, listMyCustomEventsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { PageHeader } from '@/components/patterns/page-header'
import { StatCard } from '@/components/patterns/stat-card'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { Calendar, Award, UserPlus, Shield } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'

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
  const navigate = useNavigate()
  const person = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  const membershipsQuery = useQuery<any[]>({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const res = await api.get<any>('/api/persons/me/memberships')
      return res?.data || []
    },
    retry: false,
  })

  const eventsQuery = useQuery({
    ...listMyCustomEventsOptions({ query: { limit: 10 } }),
    select: (res: any) => {
      const now = new Date()
      const items = (res?.data || []).map((e: any) => e.event || e)
      return items
        .filter((e: any) => new Date(e.startDate || e.start_date) >= now)
        .sort((a: any, b: any) => new Date(a.startDate || a.start_date).getTime() - new Date(b.startDate || b.start_date).getTime())
        .slice(0, 3)
    },
    retry: false,
  })

  const creditsQuery = useQuery<number>({
    queryKey: ['my-credit-summary'],
    queryFn: async () => {
      const res = await api.get<any>('/api/persons/me/credit-summary')
      return res?.totalCredits ?? res?.data?.totalCredits ?? 0
    },
    retry: false,
  })

  const notifsQuery = useQuery<number>({
    queryKey: ['my-unread-notif-count'],
    queryFn: async () => {
      const res = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      const items = res?.data || res?.items || []
      return items.filter((n: any) => n.status !== 'read').length
    },
    retry: false,
  })

  const memberships = membershipsQuery.data ?? []
  const membershipsLoading = membershipsQuery.isLoading
  const upcomingEvents = eventsQuery.data ?? []
  const totalCredits = creditsQuery.data ?? 0
  const unreadNotifCount = notifsQuery.data ?? 0

  const { user } = Route.useRouteContext()
  const displayName = person.data?.firstName ?? user?.name?.split(' ')[0] ?? 'there'

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
            action={{ label: 'Find Organizations', onClick: () => navigate({ to: '/my/organizations' }) }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memberships.map((m: any) => (
              <OrgCard key={m.id} membership={m} />
            ))}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard label="Organizations" value={memberships.length} />
          <StatCard label="CPD Credits" value={totalCredits} />
          <StatCard label="Upcoming Events" value={upcomingEvents.length} />
          <StatCard label="Notifications" value={unreadNotifCount} />
        </div>
      </section>

      {/* Activity sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-[var(--color-muted)]" />
            <h3 className="text-[16px] font-semibold font-display">Upcoming Events</h3>
          </div>
          {upcomingEvents.length === 0 ? (
            <EmptyState
              headline="No upcoming events"
              description="Events you register for will appear here"
            />
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((e: any, i: number) => (
                <div key={`${e.id}-${i}`} className="flex items-center justify-between py-2 border-b border-[var(--color-border-light)] last:border-0">
                  <div>
                    <p className="text-[13px] font-semibold line-clamp-1">{e.title || e.name}</p>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      {new Date(e.startDate || e.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-[var(--color-muted)]" />
            <h3 className="text-[16px] font-semibold font-display">Credit Progress</h3>
          </div>
          {totalCredits === 0 ? (
            <EmptyState
              headline="No credits yet"
              description="Complete trainings and events to earn CPD credits"
            />
          ) : (
            <div className="text-center py-4">
              <p className="text-[32px] font-bold text-[var(--color-primary)]">{totalCredits}</p>
              <p className="text-[13px] text-[var(--color-muted)]">total CPD credit hours</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function OrgCard({ membership: m }: { membership: any }) {
  const orgId = m.orgId ?? m.organizationId
  const officerQuery = useQuery<string | null>({
    queryKey: ['officer-role', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const json = await api.get<any>(`/api/persons/me/officer-role/${orgId}`)
      if (json?.data?.isOfficer) {
        return json.data.positions?.[0]?.title || 'Officer'
      }
      return null
    },
    retry: false,
    enabled: !!orgId,
  })

  const officerRole = officerQuery.data ?? null

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
      <Link
        to="/org/$orgId/home"
        params={{ orgId: orgId ?? '' }}
        className="block hover:opacity-80 transition-opacity"
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
      {officerRole && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)]">
          <Link
            to={`/org/${orgId}/officer/dashboard` as any}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            <Shield size={13} />
            {officerRole} Dashboard
          </Link>
        </div>
      )}
    </div>
  )
}
