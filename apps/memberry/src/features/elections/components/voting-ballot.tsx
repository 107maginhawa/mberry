import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Vote, CheckCircle2, AlertCircle } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import {
  getElectionOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { castBallot } from '@monobase/sdk-ts/generated/sdk.gen'
import { api } from '@/lib/api'

interface VotingBallotProps {
  electionId: string
  orgId: string
  userId?: string
}

const NOMINEE_STATUS_COLORS: Record<string, string> = {
  nominated: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  accepted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  declined: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

export function VotingBallot({ electionId, orgId, userId }: VotingBallotProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  // Check existing votes
  const { data: ballotData } = useQuery({
    queryKey: ['my-ballots', electionId],
    queryFn: () => api.get<any>(`/api/association/member/ballots?electionId=${electionId}`),
    enabled: !!electionId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-lg" />
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

  // Check if already voted
  const allBallots: any[] = ballotData?.data ?? ballotData ?? []
  const myBallots = userId ? allBallots.filter((b: any) => b.voterId === userId) : allBallots
  const hasVoted = myBallots.length > 0

  // Guard: not voting_open
  if (election.status !== 'voting_open') {
    return (
      <div className="text-center space-y-4 py-8">
        <AlertCircle className="w-10 h-10 text-[var(--color-muted)] mx-auto" />
        <p className="font-medium">Voting is not open</p>
        <p className="text-sm text-[var(--color-muted)]">
          {election.status === 'published' ? 'This election has ended and results are published.' : 'Voting has not started yet.'}
        </p>
        <button
          onClick={() => navigate({ to: '/org/$orgId/elections/$electionId', params: { orgId, electionId } })}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Back to election
        </button>
      </div>
    )
  }

  // Guard: already voted
  if (hasVoted) {
    return (
      <div className="text-center space-y-4 py-8">
        <CheckCircle2 className="w-10 h-10 text-[var(--color-success)] mx-auto" />
        <p className="font-medium">You have already voted</p>
        <p className="text-sm text-[var(--color-muted)]">Your vote has been recorded. You cannot vote again.</p>
        <button
          onClick={() => navigate({ to: '/org/$orgId/elections/$electionId', params: { orgId, electionId } })}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← View election details
        </button>
      </div>
    )
  }

  function getNomineesForPosition(positionId: string) {
    return nominees.filter((n) => n.positionId === positionId && n.status !== 'declined')
  }

  const allPositionsSelected = positions.every((p) => selections[p.id])

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Cast one ballot per position sequentially
      for (const position of positions) {
        const candidateId = selections[position.id]
        if (!candidateId) continue

        await castBallot({
          body: {
            electionId,
            positionId: position.id,
            candidateId,
            isProxy: false,
          },
          throwOnError: true,
        })
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      queryClient.invalidateQueries({ queryKey: ['my-ballots', electionId] })

      toast.success('Your votes have been cast!')
      navigate({ to: '/org/$orgId/elections/$electionId', params: { orgId, electionId } })
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to cast vote. Please try again.')
      toast.error('Failed to cast vote')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold font-display">{election.title}</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Select one candidate for each position, then submit your ballot.
        </p>
      </div>

      {/* Ballot positions */}
      {positions
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((position) => {
          const posNominees = getNomineesForPosition(position.id)
          const selected = selections[position.id]

          return (
            <div key={position.id} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[var(--color-surface-warm)] border-b">
                <p className="font-medium">{position.title}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {posNominees.length} candidate{posNominees.length !== 1 ? 's' : ''}
                  {!selected && <span className="text-[var(--color-warning)]"> · Select one</span>}
                  {selected && <span className="text-[var(--color-success)]"> · Selected ✓</span>}
                </p>
              </div>

              {posNominees.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                  No candidates for this position
                </div>
              ) : (
                <div className="divide-y">
                  {posNominees.map((nominee) => {
                    const isSelected = selected === nominee.id
                    return (
                      <label
                        key={nominee.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-warm)] transition-colors ${isSelected ? 'bg-[var(--color-primary)]/5' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`position-${position.id}`}
                          checked={isSelected}
                          onChange={() => setSelections((prev) => ({ ...prev, [position.id]: nominee.id }))}
                          className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{nominee.personId}</p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${NOMINEE_STATUS_COLORS[nominee.status] ?? ''}`}>
                              {nominee.status}
                            </span>
                          </div>
                          {nominee.bio && (
                            <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-2">{nominee.bio}</p>
                          )}
                          {nominee.platform && (
                            <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-2">{nominee.platform}</p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      {/* Submit error */}
      {submitError && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error-bg)] rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          onClick={() => navigate({ to: '/org/$orgId/elections/$electionId', params: { orgId, electionId } })}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!allPositionsSelected || submitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-primary-mid)] disabled:opacity-50 transition-colors"
        >
          <Vote className="w-4 h-4" />
          {submitting ? 'Submitting...' : 'Submit Ballot'}
        </button>
      </div>
    </div>
  )
}
