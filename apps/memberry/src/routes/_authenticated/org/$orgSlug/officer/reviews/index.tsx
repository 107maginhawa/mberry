// oli-execute: error-handled-inline
// `error` renders explicit error branch at ~L77-79. Gate heuristic misses
// the destructured rename.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Star, MessageSquare } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/reviews/',
)({
  component: OfficerReviews,
})

interface ReviewRow {
  id: string
  reviewType: string
  npsScore: number
  comment?: string | null
  reviewer: string
  reviewedEntity?: string | null
  createdAt: string
}

function npsLabel(score: number): { text: string; color: string } {
  if (score >= 9) return { text: 'Promoter', color: 'text-[var(--color-success)]' }
  if (score >= 7) return { text: 'Passive', color: 'text-[var(--color-warning)]' }
  return { text: 'Detractor', color: 'text-[var(--color-error)]' }
}

function formatReviewType(type: string): string {
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function OfficerReviews() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', orgId],
    queryFn: () =>
      api.get<{ data: ReviewRow[] }>(
        `/api/reviews/?organizationId=${orgId}`,
      ),
  })

  const reviews = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Member feedback and NPS scores"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Reviews' },
        ]}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">
          Failed to load reviews
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<Star className="w-10 h-10" />}
          headline="No reviews yet"
          description="Reviews will appear here as members submit feedback."
        />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => {
            const nps = npsLabel(review.npsScore)
            return (
              <div
                key={review.id}
                className="border rounded-lg p-4 hover:bg-[var(--color-surface-warm)] transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info)]">
                    {formatReviewType(review.reviewType)}
                  </span>
                  <span className="text-2xl font-bold font-display">
                    {review.npsScore}
                  </span>
                  <span className={`text-xs font-medium ${nps.color}`}>
                    {nps.text}
                  </span>
                  <span className="text-xs text-[var(--color-muted)] ml-auto">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                {review.comment && (
                  <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                    <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-muted)]" />
                    <p className="line-clamp-2">{review.comment}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
