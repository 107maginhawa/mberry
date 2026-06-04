import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Vote, Trophy, Users, CheckCircle2, ArrowRight, UserPlus } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
import { getElectionOptions } from '@monobase/sdk-ts/generated/react-query'
import { api } from '@/lib/api'
import { ElectionTimeline } from './election-timeline'
import { SelfNominationDialog } from './self-nomination-dialog'
import { StatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'
import { ELECTION_STATUS_VARIANT, type ElectionStatus } from '../lib/election-status'

/** Runtime election shape from API (SDK Election type has Date fields; runtime uses strings + extra fields) */
interface RuntimeElection {
  id: string
  title: string
  status: string
  type?: string
  passageThreshold?: number | string
  voterCount?: number
  positions?: unknown[]
  nominees?: unknown[]
  tallies?: { positionId: string; nomineeId: string; count: number }[]
  publishedAt?: string | null
  nominationStart?: string | null
  nominationEnd?: string | null
  nominationsOpenAt?: string | null
  nominationsCloseAt?: string | null
  votingStart?: string | null
  votingEnd?: string | null
  votingOpenAt?: string | null
  votingCloseAt?: string | null
  organizationId?: string
}

interface MemberElectionDetailProps {
  electionId: string
  orgId: string
  userId?: string
}

const STATUS_LABELS: Record<string, string> = {
  nominationsOpen: 'Nominations Open',
  votingOpen: 'Voting Open',
  awaitingConfirmation: 'Awaiting Results',
  published: 'Results Published',
}

const NOMINEE_VARIANT: Record<string, StatusBadgeVariant> = {
  nominated: 'muted',
  accepted: 'info',
  declined: 'error',
  elected: 'success',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function MemberElectionDetail({ electionId, orgId, userId }: MemberElectionDetailProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [selfNominatePositionId, setSelfNominatePositionId] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  // Check if user already voted — raw api.get due to SDK type gap
  const { data: ballotData } = useQuery({
    queryKey: ['my-ballots', electionId],
    queryFn: () => api.get<any>(`/api/association/member/ballots?electionId=${electionId}`),
    enabled: !!electionId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
        Unable to load election details. Please try refreshing the page.
      </div>
    )
  }

  if (error || !data) {
    return <div role="alert" aria-live="polite" className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
  }

  // SDK Election type has Date fields; runtime response has string dates + extra fields — use local RuntimeElection
  const election = data as unknown as RuntimeElection
  const rawPositions: any[] = election.positions ?? []
  const positions: { id: string; title: string; sortOrder: number }[] = rawPositions.map((p: any, i: number) =>
    typeof p === 'string' ? { id: p, title: p, sortOrder: i } : { id: p.id ?? p, title: p.title ?? p.id ?? `Position ${i + 1}`, sortOrder: p.sortOrder ?? i },
  )
  const nominees: any[] = election.nominees ?? []
  const tallies: { positionId: string; nomineeId: string; count: number }[] = election.tallies ?? []
  const showTallies = election.status === 'awaitingConfirmation' || election.status === 'published'
  const totalVoters = election.voterCount ?? 0

  // Determine if current user has voted
  const allBallots: any[] = ballotData?.data ?? ballotData ?? []
  const myBallots = userId ? allBallots.filter((b: any) => b.voterId === userId) : allBallots
  const hasVoted = myBallots.length > 0

  const isVotingOpen = election.status === 'votingOpen'
  const isNominationsOpen = election.status === 'nominationsOpen'

  // Find the earliest ballot timestamp for the voted-at time
  const earliestBallot = myBallots.reduce((earliest: any, b: any) => {
    if (!earliest) return b
    const eTime = earliest.createdAt ?? earliest.votedAt
    const bTime = b.createdAt ?? b.votedAt
    if (!bTime) return earliest
    if (!eTime) return b
    return new Date(bTime) < new Date(eTime) ? b : earliest
  }, null)
  const votedAt = earliestBallot?.createdAt ?? earliestBallot?.votedAt ?? null

  // Positions the user is already nominated for
  const myNominatedPositionIds = new Set(
    nominees.filter((n: any) => n.personId === userId).map((n: any) => n.positionId),
  )

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

  function getMyVoteForPosition(positionId: string) {
    return myBallots.find((b: any) => b.positionId === positionId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge variant={ELECTION_STATUS_VARIANT[election.status as ElectionStatus] ?? 'muted'}>
            {STATUS_LABELS[election.status] ?? election.status}
          </StatusBadge>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
            {election.type}
          </span>
        </div>
        <h1 className="text-h2">{election.title}</h1>
        {election.type === 'bylaw' && election.passageThreshold && (
          <p className="text-sm text-[var(--color-muted)] mt-1">Requires {election.passageThreshold}% majority to pass</p>
        )}
      </div>

      {/* Vote CTA */}
      {isVotingOpen && !hasVoted && (
        <Link
          to="/org/$orgSlug/elections/$electionId/vote"
          params={{ orgSlug, electionId }}
          className="flex items-center justify-between gap-3 p-4 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-mid)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Vote className="w-5 h-5" />
            <div>
              <p className="font-medium">Cast Your Vote</p>
              <p className="text-xs opacity-80">
                {election.votingEnd ? `Voting closes ${formatDate(election.votingEnd ?? election.votingCloseAt)}` : 'Voting is open'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
      )}

      {/* Already voted badge — enhanced receipt */}
      {isVotingOpen && hasVoted && (
        <div className="bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">Your vote has been recorded</span>
          </div>
          <p className="text-sm text-[var(--color-success)]/80 pl-7">
            You have cast your vote in this election.
          </p>
          {votedAt && (
            <p className="text-xs text-[var(--color-muted)] pl-7">
              Submitted on {formatDate(votedAt)}
            </p>
          )}
          {myBallots.length > 0 && (
            <div className="pl-7 pt-1">
              <p className="text-xs font-medium text-[var(--color-muted)] mb-1">Positions voted:</p>
              <ul className="space-y-0.5">
                {myBallots.map((b: any) => {
                  const pos = positions.find((p) => p.id === b.positionId)
                  return pos ? (
                    <li key={b.id ?? b.positionId} className="text-xs text-[var(--color-muted)]">
                      • {pos.title}
                    </li>
                  ) : null
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Election progress timeline */}
      <div className="border rounded-lg p-4">
        <ElectionTimeline
          status={election.status}
          nominationsOpenAt={election.nominationStart ?? election.nominationsOpenAt}
          nominationsCloseAt={election.nominationEnd ?? election.nominationsCloseAt}
          votingOpenAt={election.votingStart ?? election.votingOpenAt}
          votingCloseAt={election.votingEnd ?? election.votingCloseAt}
          publishedAt={election.publishedAt}
        />
      </div>

      {/* Date cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: 'Nominations Open', value: election.nominationStart ?? election.nominationsOpenAt },
          { label: 'Nominations Close', value: election.nominationEnd ?? election.nominationsCloseAt },
          { label: 'Voting Opens', value: election.votingStart ?? election.votingOpenAt },
          { label: 'Voting Closes', value: election.votingEnd ?? election.votingCloseAt },
        ].map((item) => (
          <div key={item.label} className="border rounded-lg p-3">
            <p className="text-xs text-[var(--color-muted)] mb-1">{item.label}</p>
            <p className="font-medium text-xs">{formatDate(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Voter turnout */}
      {totalVoters > 0 && showTallies && (
        <div className="flex items-center gap-3 border rounded-lg p-4">
          <Users className="w-5 h-5 text-[var(--color-muted)]" />
          <p className="font-medium">{totalVoters} voter{totalVoters !== 1 ? 's' : ''} participated</p>
        </div>
      )}

      {/* Positions & nominees */}
      {positions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-h4 flex items-center gap-2">
            <Vote className="w-4 h-4" />
            {election.type === 'officer' ? 'Positions & Candidates' : 'Items'}
          </h2>

          {positions
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((position) => {
              const posNominees = getNomineesForPosition(position.id)
              const winner = showTallies ? getWinner(position.id) : null
              const totalPositionVotes = tallies.filter((t) => t.positionId === position.id).reduce((sum, t) => sum + t.count, 0)
              const myVote = getMyVoteForPosition(position.id)

              return (
                <div key={position.id} className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-[var(--color-surface-warm)] border-b flex items-center justify-between">
                    <div>
                      <p className="font-medium">{position.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {posNominees.length} candidate{posNominees.length !== 1 ? 's' : ''}
                        {showTallies && totalPositionVotes > 0 && ` · ${totalPositionVotes} vote${totalPositionVotes !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {isNominationsOpen && userId && !myNominatedPositionIds.has(position.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelfNominatePositionId(position.id)}
                        className="text-[var(--color-primary)] shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        Nominate Yourself
                      </Button>
                    )}
                    {isNominationsOpen && userId && myNominatedPositionIds.has(position.id) && (
                      <span className="text-xs text-[var(--color-success)] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Nominated
                      </span>
                    )}
                  </div>

                  {posNominees.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                      No candidates yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {posNominees.map((nominee) => {
                        const voteCount = getTally(nominee.id)
                        const pct = totalPositionVotes > 0 ? Math.round((voteCount / totalPositionVotes) * 100) : 0
                        const isWinner = winner?.id === nominee.id && showTallies
                        const isMyVote = myVote?.nomineeId === nominee.id || myVote?.candidateId === nominee.id

                        return (
                          <div key={nominee.id} className={`px-4 py-3 flex items-center gap-3 ${isWinner ? 'bg-emerald-50' : isMyVote ? 'bg-[var(--color-primary)]/5' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isWinner && <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />}
                                {isMyVote && !isWinner && <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                                <p className="text-sm font-medium truncate">{(nominee as any).personName ?? nominee.personId}</p>
                                <StatusBadge variant={NOMINEE_VARIANT[nominee.status] ?? 'muted'}>
                                  {nominee.status}
                                </StatusBadge>
                                {isMyVote && (
                                  <span className="text-xs text-[var(--color-primary)] font-medium">Your vote</span>
                                )}
                              </div>
                              {showTallies && totalPositionVotes > 0 && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="flex-1 bg-[var(--color-surface-warm)] rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${isWinner ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[var(--color-muted)] w-16 text-right">
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
      )}

      {/* Published confirmation */}
      {election.status === 'published' && election.publishedAt && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Results published on {formatDate(election.publishedAt)}
        </div>
      )}

      {/* Self-nomination dialog */}
      {selfNominatePositionId && userId && (
        <SelfNominationDialog
          electionId={electionId}
          orgId={orgId}
          positionId={selfNominatePositionId}
          positionTitle={positions.find((p) => p.id === selfNominatePositionId)?.title ?? 'this position'}
          personId={userId}
          onClose={() => setSelfNominatePositionId(null)}
          onSuccess={() => setSelfNominatePositionId(null)}
        />
      )}

      {/* Back link */}
      <div className="pt-2">
        <Link
          to="/org/$orgSlug/elections"
          params={{ orgSlug }}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Back to Elections
        </Link>
      </div>
    </div>
  )
}
