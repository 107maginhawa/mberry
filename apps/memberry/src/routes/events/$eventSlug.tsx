import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Calendar, MapPin, Clock, Award, DollarSign, Users } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import {
  getPublicEventOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/events/$eventSlug')({
  component: PublicEventPage,
})

function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(fee: number | bigint | null | undefined, currency?: string | null) {
  if (!fee || fee === 0 || fee === 0n) return null
  const amt = Number(fee) / 100
  return `${currency ?? 'PHP'} ${amt.toLocaleString()}`
}

function PublicEventPage() {
  const { eventSlug } = Route.useParams()

  const { data, isLoading, error } = useQuery(
    getPublicEventOptions({ path: { slug: eventSlug } })
  )

  const event = (data as any)?.data ?? data

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="h-64 rounded-xl bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
        <div className="h-8 w-2/3 rounded bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
        <div className="h-4 w-1/2 rounded bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <GlassCard className="p-8">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline="Event not found"
            description="This event may have been removed or is not yet published."
          />
        </GlassCard>
      </div>
    )
  }

  const priceStr = formatPrice(event.registrationFee, event.currency)
  const cpdHours = event.creditBearing && event.creditAmount > 0 ? event.creditAmount : null
  const isCompleted = event.status === 'completed'

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Completed banner */}
      {isCompleted && (
        <div className="p-3 rounded-md bg-[var(--color-surface-warm)] text-[var(--color-muted)] text-sm text-center font-medium">
          This event has ended.
        </div>
      )}

      {/* Cover image hero */}
      {event.coverImageUrl && (
        <div className="relative h-48 sm:h-64 rounded-xl overflow-hidden">
          <img
            src={event.coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <PageHeader title={event.title ?? 'Event'} />

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {priceStr ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-surface-warm)] text-[var(--color-foreground)]">
            <DollarSign className="w-3.5 h-3.5" />
            {priceStr}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-success-bg)] text-[var(--color-success)]">
            Free
          </span>
        )}
        {cpdHours && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
            <Award className="w-3.5 h-3.5" />
            {cpdHours} CPD hours
          </span>
        )}
      </div>

      {/* Details card */}
      <GlassCard className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
            <div>
              <p className="text-body-sm font-medium text-[var(--color-muted)]">Start</p>
              <p className="text-body text-[var(--color-text)]">
                {formatDateTime(event.startDate)}
              </p>
              <p className="text-xs text-[var(--color-muted)]">Your time</p>
            </div>
          </div>

          {event.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">End</p>
                <p className="text-body text-[var(--color-text)]">
                  {formatDateTime(event.endDate)}
                </p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">Location</p>
                <p className="text-body text-[var(--color-text)]">{event.location}</p>
              </div>
            </div>
          )}

          {event.capacity && (
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">Capacity</p>
                <p className="text-body text-[var(--color-text)]">{event.capacity} spots</p>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Description */}
      {event.description && (
        <div className="space-y-2">
          <h2 className="text-h3 text-[var(--color-text)]">About this Event</h2>
          <p className="text-body leading-relaxed whitespace-pre-wrap text-[var(--color-muted)]">
            {event.description}
          </p>
        </div>
      )}

      {/* CTA — Join to register */}
      {!isCompleted && (
        <GlassCard className="p-6 text-center space-y-3">
          <p className="text-body font-medium text-[var(--color-text)]">
            Join to register for this event
          </p>
          <p className="text-body-sm text-[var(--color-muted)]">
            Registration requires membership in the organizing association.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/join">
              <Button size="lg">Join Now</Button>
            </Link>
            <Link to={'/auth/$authView' as any} params={{ authView: 'sign-in' } as any}>
              <Button size="lg" variant="outline">Sign In</Button>
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
