import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Vote, Users, CheckCircle2, Clock, FileText, Ban, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { listElectionsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface ElectionListProps {
  orgId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: FileText },
  nominations_open: { label: 'Nominations Open', color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', icon: Users },
  voting_open: { label: 'Voting Open', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', icon: Vote },
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', icon: Clock },
  published: { label: 'Results Published', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-[var(--color-error-bg)] text-[var(--color-error)]', icon: Ban },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  officer: { label: 'Officer', color: 'bg-purple-100 text-purple-800' },
  bylaw: { label: 'Bylaw', color: 'bg-orange-100 text-orange-800' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-muted text-muted-foreground', icon: FileText }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {status === 'voting_open' && <config.icon className="w-3 h-3" />}
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, color: 'bg-muted text-muted-foreground' }
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
  const { data, isLoading, error } = useQuery(
    listElectionsOptions({ query: { organizationId: orgId } }),
  )

  const elections = (data?.data ?? []) as any[]

  const stats = {
    total: elections.length,
    active: elections.filter((e) => e.status === 'voting_open' || e.status === 'nominations_open').length,
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
            <s.icon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
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
        <div className="border rounded-lg p-12 text-center text-destructive">Failed to load elections</div>
      ) : elections.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <Vote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No elections yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first election to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {elections.map((election) => (
            <Link
              key={election.id}
              to="/org/$orgId/officer/elections/$electionId"
              params={{ orgId, electionId: election.id }}
              className="flex items-center gap-4 border rounded-lg p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={election.type} />
                  <StatusBadge status={election.status} />
                </div>
                <p className="font-medium truncate">{election.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  {election.votingOpenAt && (
                    <span>Voting: {formatDate(election.votingOpenAt)}</span>
                  )}
                  {election.positions?.length > 0 && (
                    <span>{election.positions.length} position{election.positions.length !== 1 ? 's' : ''}</span>
                  )}
                  {election.type === 'bylaw' && election.passageThreshold && (
                    <span>{election.passageThreshold}% threshold</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
