import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Vote, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
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

interface PositionRecord {
  id: string
  title: string
  sortOrder: number
}

interface NomineeRecord {
  id: string
  personId: string
  personName?: string
  positionId: string
  status: string
  bio?: string
  platform?: string
}

interface BallotRecord {
  id: string
  voterId: string
  positionId: string
  nomineeId: string
}

interface ElectionData {
  title: string
  status: string
  positions?: (string | PositionRecord)[]
  nominees?: NomineeRecord[]
}

const NOMINEE_STATUS_COLORS: Record<string, string> = {
  nominated: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  accepted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  declined: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

export function VotingBallot({ electionId, orgId, userId }: VotingBallotProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [votedPositions, setVotedPositions] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  // Check existing votes
  const { data: ballotData } = useQuery({
    queryKey: ['my-ballots', electionId],
    queryFn: () => api.get<{ data: BallotRecord[] }>(`/api/association/member/ballots?electionId=${electionId}`),
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
    return <div role="alert" aria-live="polite" className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
  }

  const election = ((data as unknown as { data: ElectionData })?.data ?? data) as ElectionData
  const rawPositions = election.positions ?? []
  const positions: PositionRecord[] = rawPositions.map((p, i) =>
    typeof p === 'string' ? { id: p, title: p, sortOrder: i } : { id: p.id, title: p.title, sortOrder: p.sortOrder ?? i },
  )
  const nominees: NomineeRecord[] = election.nominees ?? []

  // Check if already voted
  const allBallots: BallotRecord[] = ballotData?.data ?? []
  const myBallots = userId ? allBallots.filter((b) => b.voterId === userId) : allBallots
  const hasVoted = myBallots.length > 0

  // Guard: not votingOpen
  if (election.status !== 'votingOpen') {
    return (
      <div className="text-center space-y-4 py-8">
        <AlertCircle className="w-10 h-10 text-[var(--color-muted)] mx-auto" />
        <p className="font-medium">Voting is not open</p>
        <p className="text-sm text-[var(--color-muted)]">
          {election.status === 'published' ? 'This election has ended and results are published.' : 'Voting has not started yet.'}
        </p>
        <Button
          variant="link"
          onClick={() => navigate({ to: '/org/$orgSlug/elections/$electionId', params: { orgSlug, electionId } })}
        >
          ← Back to election
        </Button>
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
        <Button
          variant="link"
          onClick={() => navigate({ to: '/org/$orgSlug/elections/$electionId', params: { orgSlug, electionId } })}
        >
          ← View election details
        </Button>
      </div>
    )
  }

  function getNomineesForPosition(positionId: string) {
    return nominees.filter((n) => n.positionId === positionId && n.status !== 'declined')
  }

  const allPositionsSelected = positions.every((p) => selections[p.id])

  function handleSubmitClick() {
    setShowConfirm(true)
  }

  async function handleConfirmedSubmit() {
    setShowConfirm(false)
    setSubmitting(true)
    setSubmitError(null)

    const failedPositions: string[] = []
    const newVoted = new Set(votedPositions)

    try {
      for (const position of positions) {
        const candidateId = selections[position.id]
        if (!candidateId) continue
        if (newVoted.has(position.id)) continue

        try {
          await castBallot({
            body: {
              electionId,
              positionId: position.id,
              candidateId,
              isProxy: false,
            },
            throwOnError: true,
          })
          newVoted.add(position.id)
        } catch {
          failedPositions.push(position.title)
        }
      }

      setVotedPositions(newVoted)

      if (failedPositions.length > 0) {
        setSubmitError(`Failed to cast vote for: ${failedPositions.join(', ')}. Your other votes were recorded. Please retry.`)
        toast.error(`${failedPositions.length} position(s) failed — retry to complete your ballot`)
        return
      }

      queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      queryClient.invalidateQueries({ queryKey: ['my-ballots', electionId] })

      toast.success('Your votes have been cast!')
      navigate({ to: '/org/$orgSlug/elections/$electionId', params: { orgSlug, electionId } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to cast vote. Please try again.')
      toast.error('Failed to cast vote')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-h2">{election.title}</h1>
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
                      // eslint-disable-next-line no-restricted-syntax
                      <label
                        key={nominee.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-warm)] transition-colors ${isSelected ? 'bg-[var(--color-primary)]/5' : ''}`}
                      >
                        {/* eslint-disable-next-line no-restricted-syntax -- radio input has no @monobase/ui equivalent; RadioGroup not available */}
                        <input
                          type="radio"
                          name={`position-${position.id}`}
                          checked={isSelected}
                          onChange={() => setSelections((prev) => ({ ...prev, [position.id]: nominee.id }))}
                          className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{nominee.personName ?? nominee.personId}</p>
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
        <div role="alert" aria-live="polite" className="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error-bg)] rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: '/org/$orgSlug/elections/$electionId', params: { orgSlug, electionId } })}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmitClick}
          disabled={!allPositionsSelected || submitting}
        >
          <Vote className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting...' : 'Review & Submit'}
        </Button>
      </div>

      {/* Vote confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConfirm(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-light)] p-6 max-w-md w-full mx-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Confirm Your Ballot</h3>
            <div className="space-y-2 mb-4" id="dialog-description">
              {positions.map(p => {
                const selected = nominees.find(n => n.id === selections[p.id])
                return (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">{p.title}:</span>
                    <span className="font-medium">{selected?.personName ?? selected?.personId ?? '—'}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-[var(--color-warning)] mb-4">⚠ Your vote cannot be changed after submission.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={handleConfirmedSubmit}>
                <Vote className="w-4 h-4 mr-2" />
                Submit Ballot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
