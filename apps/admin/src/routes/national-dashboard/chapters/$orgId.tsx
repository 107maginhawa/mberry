import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Users,
  TrendingUp,
  GraduationCap,
  Calendar,
  BarChart3,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'
import { getNationalChapterDetailOptions } from '@monobase/sdk-ts/generated/react-query'

type ChapterDetailSearch = { month?: string; associationId?: string }

export const Route = createFileRoute('/national-dashboard/chapters/$orgId')({
  validateSearch: (s: Record<string, unknown>): ChapterDetailSearch => ({
    month: typeof s.month === 'string' ? s.month : undefined,
    associationId: typeof s.associationId === 'string' ? s.associationId : undefined,
  }),
  component: () => (
    <RequireRole allowed={['super']}>
      <ChapterDetailPage />
    </RequireRole>
  ),
})

// The drill-down response returns ALREADY-percent values (0-100) and CENTS,
// unlike the national-dashboard index (0-1 + whole PHP). Define LOCAL helpers
// here so we never multiply a percentage twice or mis-scale money.
const pct = (v: number) => `${v.toFixed(1)}%` // value already 0-100
const peso = (cents: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100)

function ChapterDetailPage() {
  const { orgId } = Route.useParams()
  const { month, associationId } = Route.useSearch()
  const navigate = useNavigate()

  const snapshotMonth = month ?? new Date().toISOString().slice(0, 7)

  const { data, isLoading, error, refetch } = useQuery(
    getNationalChapterDetailOptions({
      path: { organizationId: orgId },
      query: { associationId, snapshotMonth },
    })
  )
  const chapter = data?.data

  return (
    <PageShell
      title={chapter?.organizationName ?? 'Chapter'}
      maxWidth="full"
      breadcrumbs={[
        { label: 'National Dashboard', href: '/national-dashboard' },
        { label: chapter?.organizationName ?? orgId },
      ]}
      subtitle={chapter ? `As of ${chapter.snapshotMonth}` : undefined}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/national-dashboard' })}>
          <ArrowLeft size={14} className="mr-1.5" />
          Back
        </Button>
      }
    >
      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error instanceof Error ? error.message : 'Failed to load chapter detail'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading — skeleton cards */}
      {isLoading && !error && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded h-20" />
          ))}
        </div>
      )}

      {/* Not found / empty */}
      {!isLoading && !error && !chapter && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No snapshot found for {snapshotMonth}.</p>
          <p className="text-xs mt-1">
            Snapshots are generated monthly. Try selecting a different month from the dashboard.
          </p>
        </div>
      )}

      {/* Suppressed — small chapter (M14-R2 k-anonymity). Do NOT render the zeroed
          metric tiles as if they were real; show a privacy notice instead. */}
      {!isLoading && !error && chapter && chapter.isSuppressed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Detailed metrics are hidden to protect member privacy
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {chapter.organizationName ?? 'This chapter'} has fewer than 5 members (
              {chapter.totalMembers} member{chapter.totalMembers === 1 ? '' : 's'}). Per-member-derived
              statistics are suppressed under k-anonymity (M14-R2).
            </p>
            <p className="text-xs text-amber-700/80 mt-2">As of {chapter.snapshotMonth}</p>
          </div>
        </div>
      )}

      {/* Full metric layout — only when not suppressed */}
      {!isLoading && !error && chapter && !chapter.isSuppressed && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
              <p className="text-2xl font-bold">{chapter.totalMembers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {pct(chapter.activePercentage)} active
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Collection Rate</p>
              </div>
              <p className="text-2xl font-bold">{pct(chapter.collectionRate)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {peso(chapter.totalRevenueCents)} collected
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">CPD Compliance</p>
              </div>
              <p className="text-2xl font-bold">{pct(chapter.creditCompliance)}</p>
              <p className="text-xs text-muted-foreground mt-1">compliant</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Activity (90d)</p>
              </div>
              <p className="text-2xl font-bold">{chapter.eventCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">events in last 90 days</p>
            </div>
          </div>

          {/* Member status breakdown */}
          <div className="rounded-lg border bg-card p-6 mb-6">
            <h2 className="text-h2 mb-4">Member Status Breakdown</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.memberStatusBreakdown.active.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                  Grace
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.memberStatusBreakdown.grace.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                  Lapsed
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.memberStatusBreakdown.lapsed.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                  Suspended
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.memberStatusBreakdown.suspended.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Credit compliance breakdown */}
          <div className="rounded-lg border bg-card p-6 mb-6">
            <h2 className="text-h2 mb-4">Credit Compliance Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                  Compliant
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.creditComplianceBreakdown.compliant.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                  Non-compliant
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.creditComplianceBreakdown.nonCompliant.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                  Exempt
                </span>
                <p className="text-2xl font-bold mt-2">
                  {chapter.creditComplianceBreakdown.exempt.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/national-dashboard"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <BarChart3 className="w-4 h-4" />
            Back to National Dashboard
          </Link>
        </>
      )}
    </PageShell>
  )
}
