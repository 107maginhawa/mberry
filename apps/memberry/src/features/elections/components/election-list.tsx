// oli-execute: error-handled-inline -- consumed by /officer/elections route.
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Vote, ChevronRight, Clock, FileText, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { listElectionsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { StatusBadge as CanonicalStatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'
import { ELECTION_STATUS_VARIANT, ELECTION_STATUS_LABELS, type ElectionStatus } from '../lib/election-status'

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

const TYPE_VARIANT: Record<string, StatusBadgeVariant> = {
  officer: 'accent',
  bylaw: 'warning',
}

const TYPE_LABEL: Record<string, string> = {
  officer: 'Officer',
  bylaw: 'Bylaw',
}

function StatusBadge({ status }: { status: string }) {
  const variant = ELECTION_STATUS_VARIANT[status as ElectionStatus] ?? 'muted'
  const label = ELECTION_STATUS_LABELS[status as ElectionStatus] ?? status
  return (
    <CanonicalStatusBadge variant={variant}>
      {status === 'votingOpen' && <Vote className="w-3 h-3" />}
      {label}
    </CanonicalStatusBadge>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <CanonicalStatusBadge variant={TYPE_VARIANT[type] ?? 'muted'}>
      {TYPE_LABEL[type] ?? type}
    </CanonicalStatusBadge>
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
