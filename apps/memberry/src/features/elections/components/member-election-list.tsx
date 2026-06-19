import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Vote, Users, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { Tabs, TabsList, TabsTrigger } from '@monobase/ui'
import { listElectionsOptions } from '@monobase/sdk-ts/generated/react-query'

interface MemberElectionListProps {
  orgId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  nominationsOpen: { label: 'Nominations Open', color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', icon: Users },
  votingOpen: { label: 'Voting Open', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', icon: Vote },
  awaitingConfirmation: { label: 'Awaiting Results', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', icon: Clock },
  published: { label: 'Results Published', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', icon: CheckCircle2 },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  officer: { label: 'Officer', color: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' },
  bylaw: { label: 'Bylaw', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
}

const MEMBER_VISIBLE = ['nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published']
const ACTIVE_STATUSES = ['nominationsOpen', 'votingOpen']

type TabFilter = 'active' | 'completed' | 'all'

/** Raw API response shape for elections (pre-SDK-transform fields). */
interface ElectionRow {
  id: string
  title: string
  status: string
  type?: string
  electionType?: string
  positions?: string[]
  votingStart?: string | Date
  votingEnd?: string | Date
  votingOpenAt?: string
  votingCloseAt?: string
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MemberElectionList({ orgId }: MemberElectionListProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [tab, setTab] = useState<TabFilter>('active')

  const { data, isLoading, error } = useQuery(
    listElectionsOptions({ query: { organizationId: orgId } }),
  )

  const allElections = ((data?.data as ElectionRow[] | undefined) ?? []).filter(
    (e) => MEMBER_VISIBLE.includes(e.status),
  )

  const elections = tab === 'all'
    ? allElections
    : tab === 'active'
    ? allElections.filter((e) => ACTIVE_STATUSES.includes(e.status))
    : allElections.filter((e) => e.status === 'published')

  const activeCount = allElections.filter((e) => ACTIVE_STATUSES.includes(e.status)).length
  const completedCount = allElections.filter((e) => e.status === 'published').length

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="active">Active ({isLoading ? '—' : activeCount})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({isLoading ? '—' : completedCount})</TabsTrigger>
          <TabsTrigger value="all">All ({isLoading ? '—' : allElections.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">
          Failed to load elections
        </div>
      ) : elections.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <Vote className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="font-medium">
            {tab === 'active' ? 'No active elections' : tab === 'completed' ? 'No completed elections' : 'No elections'}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Check back later for upcoming elections and votes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {elections.map((election) => {
            const statusCfg = STATUS_CONFIG[election.status]
            const typeCfg = TYPE_CONFIG[election.type ?? election.electionType ?? '']
            const StatusIcon = statusCfg?.icon ?? Vote

            return (
              <Link
                key={election.id}
                to="/org/$orgSlug/elections/$electionId"
                params={{ orgSlug, electionId: election.id }}
                className="flex items-center gap-4 border rounded-lg p-4 hover:bg-[var(--color-surface-warm)] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {typeCfg && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeCfg.color}`}>
                        {typeCfg.label}
                      </span>
                    )}
                    {statusCfg && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="font-medium truncate">{election.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-muted)]">
                    {election.votingStart && (
                      <span>Voting: {formatDate(String(election.votingStart))}</span>
                    )}
                    {election.votingOpenAt && !election.votingStart && (
                      <span>Voting: {formatDate(election.votingOpenAt)}</span>
                    )}
                    {(election.positions?.length ?? 0) > 0 && (
                      <span>{election.positions!.length} position{election.positions!.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
