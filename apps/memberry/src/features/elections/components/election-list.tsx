import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Vote, Users, CheckCircle2, Clock, FileText, Ban, ChevronRight } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { listElectionsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

// The elections API returns DB rows with different fields than the OpenAPI Election type.
// This local interface reflects the actual shape returned by the handler.
interface ElectionRow {
  id: string
  title: string
  type: 'officer' | 'bylaw'
  status: 'draft' | 'nominationsOpen' | 'votingOpen' | 'awaitingConfirmation' | 'published' | 'cancelled'
  votingOpenAt?: string | null
  passageThreshold?: number | null
  positions?: Array<{ id: string; title: string; sortOrder: number }> | null
}

interface ElectionListProps {
  orgId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: FileText },
  nominationsOpen: { label: 'Nominations Open', color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', icon: Users },
  votingOpen: { label: 'Voting Open', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', icon: Vote },
  awaitingConfirmation: { label: 'Awaiting Confirmation', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', icon: Clock },
  published: { label: 'Results Published', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-[var(--color-error-bg)] text-[var(--color-error)]', icon: Ban },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  officer: { label: 'Officer', color: 'bg-purple-100 text-purple-800' },
  bylaw: { label: 'Bylaw', color: 'bg-orange-100 text-orange-800' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]', icon: FileText }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {status === 'votingOpen' && <config.icon className="w-3 h-3" />}
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, color: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ElectionList({ orgId }: ElectionListProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const { data, isLoading, error } = useQuery(
    listElectionsOptions({ query: { organizationId: orgId } }),
  )

  const elections = (data?.data ?? []) as unknown as ElectionRow[]

  const stats = {
    total: elections.length,
    active: elections.filter((e) => e.status === 'votingOpen' || e.status === 'nominationsOpen').length,
    draft: elections.filter((e) => e.status === 'draft').length,
    published: elections.filter((e) => e.status === 'published').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Vote },
          { label: 'Active', value: stats.active, icon: Clock },
          { label: 'Drafts', value: stats.draft, icon: FileText },
          { label: 'Published', value: stats.published, icon: CheckCircle2 },
        ].map((s) => (
          <div key={s.label} className="border rounded-lg p-4 flex items-center gap-3">
            <s.icon className="w-5 h-5 text-[var(--color-muted)]" />
            <div>
              <p className="text-[26px] font-bold font-display">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">Failed to load elections</div>
      ) : elections.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <Vote className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="font-medium">No elections yet</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Create your first election to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {elections.map((election) => (
            <Link
              key={election.id}
              to="/org/$orgSlug/officer/elections/$electionId"
              params={{ orgSlug, electionId: election.id }}
              className="flex items-center gap-4 border rounded-lg p-4 hover:bg-[var(--color-surface-warm)] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={election.type} />
                  <StatusBadge status={election.status} />
                </div>
                <p className="font-medium truncate">{election.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-muted)]">
                  {election.votingOpenAt && (
                    <span>Voting: {formatDate(election.votingOpenAt)}</span>
                  )}
                  {(election.positions?.length ?? 0) > 0 && (
                    <span>{election.positions!.length} position{election.positions!.length !== 1 ? 's' : ''}</span>
                  )}
                  {election.type === 'bylaw' && election.passageThreshold && (
                    <span>{election.passageThreshold}% threshold</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
