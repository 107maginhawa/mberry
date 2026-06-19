import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Users, Vote, Trophy, ArrowRight, CheckCircle2, Plus, Trash2, Pencil } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import {
  getElectionOptions,
  listElectionsQueryKey,
  openElectionNominationsMutation,
  openElectionVotingMutation,
  closeElectionVotingMutation,
  certifyElectionMutation,
  deleteCandidateMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { OpenElectionNominationsData, OpenElectionVotingData, CloseElectionVotingData, CertifyElectionData } from '@monobase/sdk-ts/generated/types.gen'
import type { Options } from '@monobase/sdk-ts/generated/sdk.gen'
import { NomineePickerDialog } from './nominee-picker-dialog'
import { ElectionTimeline } from './election-timeline'
import {
  ELECTION_STATUS_VARIANT,
  ELECTION_STATUS_LABELS,
  STATUS_TRANSITIONS,
  type ElectionStatus,
} from '../lib/election-status'
import { StatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'

/** Runtime election shape from API (SDK Election type has Date fields; runtime uses strings + extra fields) */
interface RuntimeElection {
  id: string
  title: string
  status: string
  type?: string
  votingMode?: string
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

interface ElectionDetailProps {
  electionId: string
  orgId: string
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

export function ElectionDetail({ electionId, orgId }: ElectionDetailProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [nominatePositionId, setNominatePositionId] = useState<string | null>(null)
  const [confirmRemoveNominee, setConfirmRemoveNominee] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  const onStatusSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
    queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
    setConfirmAction(null)
  }

  const onStatusError = (err: Error) => {
    toast.error(err.message || 'Failed to update election status')
    setConfirmAction(null)
  }

  const nominationsMutation = useMutation({
    mutationFn: openElectionNominationsMutation().mutationFn,
    onSuccess: onStatusSuccess,
    onError: onStatusError,
  })
  const votingMutation = useMutation({
    mutationFn: openElectionVotingMutation().mutationFn,
    onSuccess: onStatusSuccess,
    onError: onStatusError,
  })
  const closeVotingMut = useMutation({
    mutationFn: closeElectionVotingMutation().mutationFn,
    onSuccess: onStatusSuccess,
    onError: onStatusError,
  })
  const certifyMut = useMutation({
    mutationFn: certifyElectionMutation().mutationFn,
    onSuccess: onStatusSuccess,
    onError: onStatusError,
  })

  function handleStatusAdvance(nextStatus: ElectionStatus) {
    const electionPath = { path: { electionId } }
    if (nextStatus === 'nominationsOpen') nominationsMutation.mutate(electionPath as Options<OpenElectionNominationsData>)
    else if (nextStatus === 'votingOpen') votingMutation.mutate(electionPath as Options<OpenElectionVotingData>)
    else if (nextStatus === 'awaitingConfirmation') closeVotingMut.mutate(electionPath as Options<CloseElectionVotingData>)
    else certifyMut.mutate(electionPath as Options<CertifyElectionData>)
  }

  const removeNomineeMut = useMutation({
    mutationFn: deleteCandidateMutation().mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
      toast.success('Nominee removed')
      setConfirmRemoveNominee(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove nominee')
    },
  })

  const statusMutationPending = nominationsMutation.isPending || votingMutation.isPending || closeVotingMut.isPending || certifyMut.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (isError || error || !data) {
    return <div role="alert" aria-live="polite" className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
  }

  // SDK Election type has Date fields; runtime response has string dates + extra fields — use local RuntimeElection
  // ISSUE-027: getElection returns { data: election } though the contract is a flat
  // Election, so reading data.status/title directly yielded undefined → blank detail
  // with no lifecycle actions. Unwrap the {data} envelope defensively (as the
  // member voting-ballot component already does) until the backend wrap is fixed.
  const election = ((data as { data?: unknown })?.data ?? data) as unknown as RuntimeElection
  const electionStatus = election.status as ElectionStatus
  const nextAction = STATUS_TRANSITIONS[electionStatus] ?? null
  const rawPositions: any[] = election.positions ?? []
  const positions: { id: string; title: string; sortOrder: number }[] = rawPositions.map((p: any, i: number) =>
    typeof p === 'string' ? { id: p, title: p, sortOrder: i } : { id: p.id ?? p, title: p.title ?? p.id ?? `Position ${i + 1}`, sortOrder: p.sortOrder ?? i },
  )
  const nominees: any[] = election.nominees ?? []
  const tallies: { positionId: string; nomineeId: string; count: number }[] = election.tallies ?? []
  const showTallies = electionStatus === 'awaitingConfirmation' || electionStatus === 'published'
  const canManageNominees = electionStatus === 'draft' || electionStatus === 'nominationsOpen'

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
            <StatusBadge variant={ELECTION_STATUS_VARIANT[electionStatus] ?? 'muted'}>
              {ELECTION_STATUS_LABELS[electionStatus] ?? electionStatus}
            </StatusBadge>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
              {election.type}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
              {election.votingMode?.replace('_', '-')}
            </span>
          </div>
          <h1 className="text-h2">{election.title}</h1>
          {election.type === 'bylaw' && election.passageThreshold && (
            <p className="text-sm text-[var(--color-muted)] mt-1">Requires {election.passageThreshold}% majority to pass</p>
          )}
        </div>

        {/* Edit + Phase action */}
        <div className="flex items-center gap-2">
          {election.status === 'draft' && (
            <Link
              to="/org/$orgSlug/officer/elections/$electionId/edit"
              params={{ orgSlug, electionId }}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
          )}
        {nextAction && election.status !== 'cancelled' && (
          <div>
            {confirmAction === nextAction.nextStatus ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-muted)]">Confirm?</span>
                <Button
                  size="sm"
                  onClick={() => handleStatusAdvance(nextAction.nextStatus)}
                  disabled={statusMutationPending}
                >
                  {statusMutationPending ? 'Updating...' : 'Yes, proceed'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmAction(nextAction.nextStatus)}
              >
                {nextAction.label}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
          </div>
        )}
        </div>
      </div>

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
          { label: 'Nominations Open', value: election.nominationStart },
          { label: 'Nominations Close', value: election.nominationEnd },
          { label: 'Voting Opens', value: election.votingStart },
          { label: 'Voting Closes', value: election.votingEnd },
        ].map((item) => (
          <div key={item.label} className="border rounded-lg p-3">
            <p className="text-xs text-[var(--color-muted)] mb-1">{item.label}</p>
            <p className="font-medium text-xs">{formatDate(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Voter turnout */}
      {totalVoters > 0 && (
        <div className="flex items-center gap-3 border rounded-lg p-4">
          <Users className="w-5 h-5 text-[var(--color-muted)]" />
          <div>
            <p className="font-medium">{totalVoters} voter{totalVoters !== 1 ? 's' : ''} participated</p>
          </div>
        </div>
      )}

      {/* Positions & nominees */}
      {positions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-h4 flex items-center gap-2">
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
                  <div className="px-4 py-3 bg-[var(--color-surface-warm)] border-b flex items-center justify-between">
                    <div>
                      <p className="font-medium">{position.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {posNominees.length} nominee{posNominees.length !== 1 ? 's' : ''}
                        {showTallies && totalPositionVotes > 0 && ` · ${totalPositionVotes} vote${totalPositionVotes !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {canManageNominees && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNominatePositionId(position.id)}
                        className="text-[var(--color-primary)]"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>

                  {posNominees.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                      No nominees yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {posNominees.map((nominee) => {
                        const voteCount = getTally(nominee.id)
                        const pct = totalPositionVotes > 0 ? Math.round((voteCount / totalPositionVotes) * 100) : 0
                        const isWinner = winner?.id === nominee.id && showTallies

                        return (
                          <div key={nominee.id} className={`px-4 py-3 flex items-center gap-3 ${isWinner ? 'bg-[var(--color-success-bg)]' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isWinner && <Trophy className="w-4 h-4 text-[var(--color-success)] shrink-0" />}
                                <p className="text-sm font-medium truncate">{(nominee as any).personName ?? nominee.personId}</p>
                                <StatusBadge variant={NOMINEE_VARIANT[nominee.status] ?? 'muted'}>
                                  {nominee.status}
                                </StatusBadge>
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
                            {canManageNominees && (
                              confirmRemoveNominee === nominee.id ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeNomineeMut.mutate({ path: { candidateId: nominee.id } })}
                                    disabled={removeNomineeMut.isPending}
                                  >
                                    {removeNomineeMut.isPending ? '...' : 'Remove'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmRemoveNominee(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setConfirmRemoveNominee(nominee.id)}
                                  className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-error)]"
                                  aria-label="Remove nominee"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )
                            )}
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
        <div className="border rounded-lg p-8 text-center text-[var(--color-muted)] text-sm">
          No positions defined yet
        </div>
      )}

      {/* Published confirmation */}
      {election.status === 'published' && election.publishedAt && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Results published on {formatDate(election.publishedAt)}
        </div>
      )}

      {/* Nominee picker dialog */}
      {nominatePositionId && (
        <NomineePickerDialog
          orgId={orgId}
          electionId={electionId}
          positionId={nominatePositionId}
          existingNomineePersonIds={nominees.filter((n) => n.positionId === nominatePositionId).map((n: any) => n.personId)}
          onClose={() => setNominatePositionId(null)}
        />
      )}
    </div>
  )
}
