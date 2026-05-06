import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Vote, Trophy, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getElectionOptions,
  listElectionsQueryKey,
  openElectionNominationsMutation,
  openElectionVotingMutation,
  certifyElectionMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface ElectionDetailProps {
  electionId: string
  orgId: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  nominations_open: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  voting_open: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  awaiting_confirmation: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  published: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  nominations_open: 'Nominations Open',
  voting_open: 'Voting Open',
  awaiting_confirmation: 'Awaiting Confirmation',
  published: 'Results Published',
  cancelled: 'Cancelled',
}

const NOMINEE_STATUS_COLORS: Record<string, string> = {
  nominated: 'bg-muted text-muted-foreground',
  accepted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  declined: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  elected: 'bg-emerald-100 text-emerald-800',
}

// Status transition map: current status → next action
const NEXT_ACTION: Record<string, { label: string; nextStatus: string } | null> = {
  draft: { label: 'Open Nominations', nextStatus: 'nominations_open' },
  nominations_open: { label: 'Open Voting', nextStatus: 'voting_open' },
  voting_open: { label: 'Close Voting', nextStatus: 'awaiting_confirmation' },
  awaiting_confirmation: { label: 'Publish Results', nextStatus: 'published' },
  published: null,
  cancelled: null,
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ElectionDetail({ electionId, orgId }: ElectionDetailProps) {
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  const onStatusSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
    queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
    setConfirmAction(null)
  }

  const nominationsMutation = useMutation({
    mutationFn: openElectionNominationsMutation().mutationFn,
    onSuccess: onStatusSuccess,
  })
  const votingMutation = useMutation({
    mutationFn: openElectionVotingMutation().mutationFn,
    onSuccess: onStatusSuccess,
  })
  const certifyMut = useMutation({
    mutationFn: certifyElectionMutation().mutationFn,
    onSuccess: onStatusSuccess,
  })

  function handleStatusAdvance(nextStatus: string) {
    const opts = { path: { electionId } } as any
    if (nextStatus === 'nominations_open') nominationsMutation.mutate(opts)
    else if (nextStatus === 'voting_open') votingMutation.mutate(opts)
    else certifyMut.mutate(opts)
  }

  const statusMutationPending = nominationsMutation.isPending || votingMutation.isPending || certifyMut.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (error || !data) {
    return <div className="p-6 text-center text-destructive">Failed to load election</div>
  }

  const election = data as any
  const nextAction = NEXT_ACTION[election.status as string]
  const positions: { id: string; title: string; sortOrder: number }[] = election.positions ?? []
  const nominees: any[] = election.nominees ?? []
  const tallies: { positionId: string; nomineeId: string; count: number }[] = election.tallies ?? []
  const showTallies = election.status === 'awaiting_confirmation' || election.status === 'published'

  function getNomineesForPosition(positionId: string) {
    return nominees.filter((n) => n.positionId === positionId)
  }

  function getTally(nomineeId: string) {
    return tallies.find((t) => t.nomineeId === nomineeId)?.count ?? 0
  }

  function getWinner(positionId: string) {
    const posNominees = getNomineesForPosition(positionId)
    if (!posNominees.length) return null
    const sorted = [...posNominees].sort((a, b) => getTally(b.id) - getTally(a.id))
    return sorted[0]
  }

  const totalVoters = election.voterCount ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[election.status] ?? ''}`}>
              {STATUS_LABELS[election.status] ?? election.status}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">
              {election.type}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">
              {election.votingMode?.replace('_', '-')}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{election.title}</h1>
          {election.type === 'bylaw' && election.passageThreshold && (
            <p className="text-sm text-muted-foreground mt-1">Requires {election.passageThreshold}% majority to pass</p>
          )}
        </div>

        {/* Phase action */}
        {nextAction && election.status !== 'cancelled' && (
          <div>
            {confirmAction === nextAction.nextStatus ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confirm?</span>
                <button
                  onClick={() => handleStatusAdvance(nextAction.nextStatus)}
                  disabled={statusMutationPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {statusMutationPending ? 'Updating...' : 'Yes, proceed'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1.5 border rounded text-sm hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction(nextAction.nextStatus)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
              >
                {nextAction.label}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: 'Nominations Open', value: election.nominationsOpenAt },
          { label: 'Nominations Close', value: election.nominationsCloseAt },
          { label: 'Voting Opens', value: election.votingOpenAt },
          { label: 'Voting Closes', value: election.votingCloseAt },
        ].map((item) => (
          <div key={item.label} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="font-medium text-xs">{formatDate(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Voter turnout */}
      {totalVoters > 0 && (
        <div className="flex items-center gap-3 border rounded-lg p-4">
          <Users className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{totalVoters} voter{totalVoters !== 1 ? 's' : ''} participated</p>
          </div>
        </div>
      )}

      {/* Positions & nominees */}
      {positions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Vote className="w-4 h-4" />
            {election.type === 'officer' ? 'Positions & Nominees' : 'Items & Votes'}
          </h2>

          {positions
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((position) => {
              const posNominees = getNomineesForPosition(position.id)
              const winner = showTallies ? getWinner(position.id) : null
              const totalPositionVotes = tallies.filter((t) => t.positionId === position.id).reduce((sum, t) => sum + t.count, 0)

              return (
                <div key={position.id} className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <p className="font-medium">{position.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {posNominees.length} nominee{posNominees.length !== 1 ? 's' : ''}
                      {showTallies && totalPositionVotes > 0 && ` · ${totalPositionVotes} vote${totalPositionVotes !== 1 ? 's' : ''}`}
                    </p>
                  </div>

                  {posNominees.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No nominees yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {posNominees.map((nominee) => {
                        const voteCount = getTally(nominee.id)
                        const pct = totalPositionVotes > 0 ? Math.round((voteCount / totalPositionVotes) * 100) : 0
                        const isWinner = winner?.id === nominee.id && showTallies

                        return (
                          <div key={nominee.id} className={`px-4 py-3 flex items-center gap-3 ${isWinner ? 'bg-emerald-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isWinner && <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />}
                                <p className="font-mono text-xs truncate text-muted-foreground">{nominee.personId}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${NOMINEE_STATUS_COLORS[nominee.status] ?? ''}`}>
                                  {nominee.status}
                                </span>
                              </div>
                              {showTallies && totalPositionVotes > 0 && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${isWinner ? 'bg-emerald-500' : 'bg-primary'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-16 text-right">
                                    {voteCount} ({pct}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No positions defined yet
        </div>
      )}

      {/* Published confirmation */}
      {election.status === 'published' && election.publishedAt && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Results published on {formatDate(election.publishedAt)}
        </div>
      )}
    </div>
  )
}
