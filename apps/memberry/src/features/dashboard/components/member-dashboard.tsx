import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarDays, BookOpen, Bell, CreditCard, ChevronRight, Shield } from 'lucide-react'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { EmptyState } from '@/components/patterns/empty-state'
import { Button } from '@/components/ui/button'

interface Membership {
  id: string
  orgId: string
  orgName: string
  status: 'active' | 'grace' | 'lapsed' | 'pending'
  duesExpiryDate?: string
  memberNumber?: string
}

interface OrgEvent {
  id: string
  title: string
  startDate: string
  orgName: string
  orgId: string
}

interface Training {
  id: string
  title: string
  startDate: string
  cpdCredits: number
  orgName: string
  orgId: string
}

interface Notification {
  id: string
  title: string
  createdAt: string
  read: boolean
  category: string
}

export function MemberDashboard() {
  const memberships = useQuery<Membership[]>({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const res = await fetch('/api/persons/me/memberships')
      return (await res.json()).data ?? []
    },
    retry: false,
  })

  const events = useQuery<OrgEvent[]>({
    queryKey: ['my-events'],
    queryFn: async () => {
      const res = await fetch('/api/events/my')
      return (await res.json()).data ?? []
    },
    retry: false,
  })

  const trainings = useQuery<Training[]>({
    queryKey: ['my-trainings'],
    queryFn: async () => {
      const res = await fetch('/api/training/my')
      return (await res.json()).data ?? []
    },
    retry: false,
  })

  const notifications = useQuery<Notification[]>({
    queryKey: ['my-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/my?limit=3')
      return (await res.json()).data ?? []
    },
    retry: false,
  })

  const upcomingEvents = (events.data ?? [])
    .filter((e) => new Date(e.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3)

  const upcomingTrainings = (trainings.data ?? [])
    .filter((t) => new Date(t.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3)

  const recentNotifs = (notifications.data ?? []).slice(0, 3)

  return (
    <div className="space-y-8">
      {/* Org membership cards */}
      <section>
        <SectionHeading title="Your Organizations" />
        {memberships.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (memberships.data ?? []).length === 0 ? (
          <EmptyState
            headline="No memberships yet"
            description="Join an organization to get started"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(memberships.data ?? []).map((m) => (
              <MembershipCard key={m.id} membership={m} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Upcoming events */}
        <section className="md:col-span-1">
          <SectionHeading
            title="Upcoming Events"
            linkTo="/my/events"
            icon={<CalendarDays size={16} className="text-[var(--color-muted)]" />}
          />
          <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-light)]">
            {events.isLoading ? (
              <div className="p-4 space-y-2">
                <CardSkeleton />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-[var(--color-muted)] p-4">No upcoming events</p>
            ) : (
              upcomingEvents.map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <p className="text-[13px] font-semibold line-clamp-1">{e.title}</p>
                  <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                    {new Date(e.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">{e.orgName}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Upcoming trainings */}
        <section className="md:col-span-1">
          <SectionHeading
            title="Upcoming Trainings"
            linkTo="/my/training"
            icon={<BookOpen size={16} className="text-[var(--color-muted)]" />}
          />
          <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-light)]">
            {trainings.isLoading ? (
              <div className="p-4">
                <CardSkeleton />
              </div>
            ) : upcomingTrainings.length === 0 ? (
              <p className="text-[13px] text-[var(--color-muted)] p-4">No upcoming trainings</p>
            ) : (
              upcomingTrainings.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold line-clamp-1">{t.title}</p>
                    {t.cpdCredits > 0 && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)]">
                        {t.cpdCredits} CPD
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                    {new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent notifications */}
        <section className="md:col-span-1">
          <SectionHeading
            title="Recent Notifications"
            linkTo="/my/notifications"
            icon={<Bell size={16} className="text-[var(--color-muted)]" />}
          />
          <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-light)]">
            {notifications.isLoading ? (
              <div className="p-4">
                <CardSkeleton />
              </div>
            ) : recentNotifs.length === 0 ? (
              <p className="text-[13px] text-[var(--color-muted)] p-4">No notifications</p>
            ) : (
              recentNotifs.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${!n.read ? 'border-l-2 border-l-[var(--color-primary)]' : ''}`}>
                  <p className={`text-[13px] line-clamp-2 ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function MembershipCard({ membership: m }: { membership: Membership }) {
  const needsPay = m.status === 'grace' || m.status === 'lapsed'
  const [isOfficer, setIsOfficer] = useState(false)
  const [officerRole, setOfficerRole] = useState('')

  useEffect(() => {
    fetch(`/api/persons/me/officer-role/${m.orgId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data?.isOfficer) {
          setIsOfficer(true)
          setOfficerRole(json.data.positions?.[0]?.title || 'Officer')
        }
      })
      .catch(() => {})
  }, [m.orgId])

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <AvatarInitials name={m.orgName} size="md" />
          <div>
            <p className="text-[14px] font-semibold">{m.orgName}</p>
            {m.memberNumber && (
              <p className="text-[12px] text-[var(--color-muted)]">#{m.memberNumber}</p>
            )}
          </div>
        </div>
        <StatusBadge status={m.status} />
      </div>

      {m.duesExpiryDate && (
        <p className="text-[12px] text-[var(--color-muted)] mt-3">
          Dues expire: {new Date(m.duesExpiryDate).toLocaleDateString()}
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        {isOfficer && (
          <Link
            to={`/org/${m.orgId}/officer/dashboard`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white px-4 py-1.5 rounded-[8px] transition-colors"
          >
            <Shield size={13} />
            {officerRole} Dashboard
          </Link>
        )}
        {needsPay && (
          <a
            href={`/org/${m.orgId}/payments`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-mid)] px-4 py-1.5 rounded-[8px] transition-colors"
          >
            <CreditCard size={13} />
            Pay Dues
          </a>
        )}
      </div>
    </div>
  )
}

function SectionHeading({
  title,
  linkTo,
  icon,
}: {
  title: string
  linkTo?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[16px] font-semibold font-display flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      {linkTo && (
        <Link
          to={linkTo as any}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          View all <ChevronRight size={13} />
        </Link>
      )}
    </div>
  )
}
