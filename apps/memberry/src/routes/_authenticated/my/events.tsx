import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Calendar, Building2, Award, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  listMyCustomEventsOptions,
  listMyCustomEventsQueryKey,
  cancelEventRegistrationMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'

export const Route = createFileRoute('/_authenticated/my/events')({
  component: MyEvents,
})

const REG_STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  confirmed: { bg: 'bg-emerald-100 text-emerald-800', label: 'Confirmed' },
  waitlisted: { bg: 'bg-amber-100 text-amber-800', label: 'Waitlisted' },
  cancelled: { bg: 'bg-red-100 text-red-800', label: 'Cancelled' },
  pendingPayment: { bg: 'bg-orange-100 text-orange-800', label: 'Pending Payment' },
  refunded: { bg: 'bg-gray-100 text-gray-600', label: 'Refunded' },
  noShow: { bg: 'bg-gray-100 text-gray-600', label: 'No Show' },
}

function formatEventDate(startDate: string) {
  return new Date(startDate).toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(startDate: string): string | null {
  const diff = new Date(startDate).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function isUpcoming(startDate: string) {
  return new Date(startDate) >= new Date()
}

function EventRegistrationCard({ item }: { item: { registration: any; event: any } }) {
  const { registration, event } = item
  const upcoming = isUpcoming(event.startDate)
  const orgId = event.organizationId
  const queryClient = useQueryClient()

  const cancelMutation = useMutation({
    ...cancelEventRegistrationMutation(),
    onSuccess: () => {
      toast.success('Registration cancelled.')
      queryClient.invalidateQueries({ queryKey: listMyCustomEventsQueryKey() })
    },
    onError: (err: any) => {
      const msg = err?.body?.message ?? err?.body?.error ?? err?.message ?? 'Cancellation failed'
      toast.error(msg)
    },
  })

  const regStatus = REG_STATUS_STYLES[registration.status] ?? { bg: 'bg-gray-100 text-gray-600', label: registration.status }
  const canCancel = upcoming && registration.status !== 'cancelled' && registration.status !== 'refunded'
  const countdown = upcoming ? formatCountdown(event.startDate) : null
  const credits = event.cpdCredits ?? event.cpd_credits ?? event.credits ?? null

  return (
    <GlassCard className={`overflow-hidden ${!upcoming ? 'opacity-75' : ''}`}>
      {/* Clickable card body → event detail */}
      <Link
        to="/org/$orgId/events/$eventId"
        params={{ orgId: orgId ?? '', eventId: event.id }}
        className="block p-4 space-y-3 hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${regStatus.bg}`}>
              {regStatus.label}
            </span>
            {credits != null && credits > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
                <Award size={10} />
                {credits} CPD
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {countdown && (
              <span className="text-[11px] font-semibold text-[var(--color-primary)]">{countdown}</span>
            )}
            {!upcoming && (
              <span className="text-[11px] text-[var(--color-muted)]">Past</span>
            )}
            <ExternalLink size={12} className="text-[var(--color-muted)]" />
          </div>
        </div>

        <h3 className="text-h4">{event.title}</h3>

        <div className="space-y-1.5 text-[13px] text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="shrink-0" />
            <span>{formatEventDate(event.startDate)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <Building2 size={13} className="shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Action row — cancel button for upcoming */}
      {canCancel && (
        <div className="px-4 py-2.5 border-t border-[var(--color-surface-border-glass)] flex items-center justify-between">
          <span className="text-body-sm text-[var(--color-muted)]">
            {registration.status === 'waitlisted' ? 'On waitlist' : 'You\'re registered'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[12px] text-red-600 border-red-200 hover:bg-red-50"
            disabled={cancelMutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const regId = registration.id
              if (regId) {
                cancelMutation.mutate({ path: { registrationId: regId } })
              } else {
                toast.error('Unable to find registration ID')
              }
            }}
          >
            {cancelMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Cancel
          </Button>
        </div>
      )}

      {/* Past event: show attendance result */}
      {!upcoming && registration.status !== 'cancelled' && (
        <div className="px-4 py-2.5 border-t border-[var(--color-surface-border-glass)]">
          <span className="text-body-sm text-[var(--color-muted)]">
            {registration.status === 'noShow'
              ? 'Did not attend'
              : registration.checkedIn || registration.checked_in
                ? 'Attended'
                : 'Attendance not recorded'
            }
          </span>
        </div>
      )}
    </GlassCard>
  )
}

function MyEvents() {
  const [showPast, setShowPast] = useState(false)

  const { data, isLoading, error } = useQuery(
    listMyCustomEventsOptions()
  )

  const allItems: Array<{ registration: any; event: any }> = (data as any)?.data ?? []
  const now = new Date()
  const upcoming = allItems.filter((item: any) => new Date(item.event.startDate) >= now)
  const past = allItems.filter((item: any) => new Date(item.event.startDate) < now)
  const displayed = showPast ? allItems : upcoming

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Events"
        subtitle="Events you're registered for across all organizations"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <p className="text-body-sm text-[var(--color-muted)]">Upcoming</p>
          {isLoading ? (
            <div className="h-8 w-12 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer mt-1" />
          ) : (
            <CountUp value={upcoming.length} className="text-h2 font-bold font-display block mt-1" />
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-body-sm text-[var(--color-muted)]">Past</p>
          {isLoading ? (
            <div className="h-8 w-12 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer mt-1" />
          ) : (
            <CountUp value={past.length} className="text-h2 font-bold font-display block mt-1" />
          )}
        </GlassCard>
      </div>

      {/* Toggle */}
      <GlassCard className="flex gap-1 p-1 w-fit">
        <button
          onClick={() => setShowPast(false)}
          className={`px-3 py-1.5 rounded-[8px] text-body-sm font-semibold transition-colors ${
            !showPast ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`px-3 py-1.5 rounded-[8px] text-body-sm font-semibold transition-colors ${
            showPast ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          All
        </button>
      </GlassCard>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="p-4 space-y-3">
              <div className="h-5 w-20 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-5 w-3/4 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-1/2 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-2/3 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
            </GlassCard>
          ))}
        </div>
      ) : error ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline="Failed to load events"
            description="Something went wrong. Please try again."
          />
        </GlassCard>
      ) : displayed.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline={showPast ? 'No events found' : 'No upcoming events'}
            description={showPast ? 'You haven\'t registered for any events yet.' : 'Check back soon for new events!'}
          />
        </GlassCard>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2">
          {displayed.map((item: any) => (
            <StaggerItem key={item.registration.id}>
              <EventRegistrationCard item={item} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  )
}
