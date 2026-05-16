import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Vote, Trophy, Users, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { getElectionOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { api } from '@/lib/api'

interface MemberElectionDetailProps {
  electionId: string
  orgId: string
  userId?: string
}

const STATUS_COLORS: Record<string, string> = {
  nominations_open: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  voting_open: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  awaiting_confirmation: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  published: 'bg-emerald-100 text-emerald-800',
}

const STATUS_LABELS: Record<string, string> = {
  nominations_open: 'Nominations Open',
  voting_open: 'Voting Open',
  awaiting_confirmation: 'Awaiting Results',
  published: 'Results Published',
}

const NOMINEE_STATUS_COLORS: Record<string, string> = {
  nominated: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  accepted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  declined: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  elected: 'bg-emerald-100 text-emerald-800',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function MemberElectionDetail({ electionId, orgId, userId }: MemberElectionDetailProps) {
  const { data, isLoading, error } = useQuery(
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

  if (error || !data) {
    return <div className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
  }

  const election = (data as any)?.data ?? data
  const rawPositions: any[] = election.positions ?? []
  const positions: { id: string; title: string; sortOrder: number }[] = rawPositions.map((p: any, i: number) =>
    typeof p === 'string' ? { id: p, title: p, sortOrder: i } : { id: p.id ?? p, title: p.title ?? p.id ?? `Position ${i + 1}`, sortOrder: p.sortOrder ?? i },
  )
  const nominees: any[] = election.nominees ?? []
  const tallies: { positionId: string; nomineeId: string; count: number }[] = election.tallies ?? []
  const showTallies = election.status === 'awaiting_confirmation' || election.status === 'published'
  const totalVoters = election.voterCount ?? 0

  // Determine if current user has voted
  const allBallots: any[] = ballotData?.data ?? ballotData ?? []
  const myBallots = userId ? allBallots.filter((b: any) => b.voterId === userId) : allBallots
  const hasVoted = myBallots.length > 0

  const isVotingOpen = election.status === 'voting_open'

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
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[election.status] ?? 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]'}`}>
            {STATUS_LABELS[election.status] ?? election.status}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
            {election.type}
          </span>
        </div>
        <h1 className="text-[26px] font-bold font-display">{election.title}</h1>
        {election.type === 'bylaw' && election.passageThreshold && (
          <p className="text-sm text-[var(--color-muted)] mt-1">Requires {election.passageThreshold}% majority to pass</p>
        )}
      </div>

      {/* Vote CTA */}
      {isVotingOpen && !hasVoted && (
        <Link
          to="/org/$orgId/elections/$electionId/vote"
          params={{ orgId, electionId }}
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

      {/* Already voted badge */}
      {isVotingOpen && hasVoted && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          You have cast your vote in this election
        </div>
      )}

      {/* Timeline */}
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
          <h2 className="font-semibold flex items-center gap-2">
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
                  <div className="px-4 py-3 bg-[var(--color-surface-warm)] border-b">
                    <p className="font-medium">{position.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {posNominees.length} candidate{posNominees.length !== 1 ? 's' : ''}
                      {showTallies && totalPositionVotes > 0 && ` · ${totalPositionVotes} vote${totalPositionVotes !== 1 ? 's' : ''}`}
                    </p>
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
                                <p className="font-mono text-xs truncate text-[var(--color-muted)]">{nominee.personId}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${NOMINEE_STATUS_COLORS[nominee.status] ?? ''}`}>
                                  {nominee.status}
                                </span>
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

      {/* Back link */}
      <div className="pt-2">
        <Link
          to="/org/$orgId/elections"
          params={{ orgId }}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Back to Elections
        </Link>
      </div>
    </div>
  )
}
