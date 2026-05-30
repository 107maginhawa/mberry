import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GlassCard } from '@/components/motion/glass-card'
import { StatCard } from '@/components/patterns/stat-card'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { CheckCircle2, Circle, Award, FileText, Mail, Flag, Loader2, Undo2 } from 'lucide-react'
import {
  listCustomEventAttendanceOptions,
  getMyOfficerRoleOptions,
  awardManualCreditMutation,
  bulkIssueCertificatesMutation,
  completeEventMutation,
  createMessageMutation,
  sendMessageMutation,
  getEventQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import { CSRF_HEADER, readCsrfCookie } from '@monobase/sdk-ts/csrf'

interface PostEventActionsProps {
  event: {
    id: string
    title: string
    status: string
    startDate: string
    endDate: string
    creditBearing?: boolean
    creditAmount?: number | null
    cpdActivityType?: string | null
    registrationCount?: number | null
  }
  orgId: string
  orgSlug: string
  userId: string
  onEventCompleted?: () => void
}

const CREDIT_POSITIONS = ['president', 'secretary', 'treasurer']

// Persist completion state across page reloads
function getCompletionState(eventId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`post-event-${eventId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function setCompletionState(eventId: string, key: string, value: boolean) {
  const state = getCompletionState(eventId)
  state[key] = value
  localStorage.setItem(`post-event-${eventId}`, JSON.stringify(state))
}

export function PostEventActions({ event, orgId, orgSlug, userId, onEventCompleted }: PostEventActionsProps) {
  const queryClient = useQueryClient()
  const eventDate = new Date(event.endDate)
  const isPast = eventDate < new Date()

  // Fetch attendance data (checked-in personIds)
  const { data: attendanceData } = useQuery(
    listCustomEventAttendanceOptions({ path: { eventId: event.id } })
  )
  const attendees = (attendanceData?.data ?? []) as Array<{ personId: string; registrationId: string }>
  const attendeePersonIds = useMemo(() => attendees.map(a => a.personId), [attendees])

  // Check officer position for permission gating
  const { data: officerData } = useQuery(
    getMyOfficerRoleOptions({ path: { organizationId: orgId } })
  )
  const positions = (officerData?.data?.positions ?? []) as Array<{ title: string }>
  const positionTitles = positions.map(p => p.title.toLowerCase())
  const canAwardCredits = positionTitles.some(t => CREDIT_POSITIONS.includes(t))
  const canIssueCerts = positionTitles.some(t => ['president', 'secretary'].includes(t))

  // Completion states
  const [completionState, setLocalCompletionState] = useState(() => getCompletionState(event.id))
  const isCompleted = event.status === 'completed'
  const creditsAwarded = completionState.creditsAwarded ?? false
  const certsGenerated = completionState.certsGenerated ?? false
  const thankYouSent = completionState.thankYouSent ?? false

  function markDone(key: string) {
    setCompletionState(event.id, key, true)
    setLocalCompletionState(prev => ({ ...prev, [key]: true }))
  }

  // --- Award Credits ---
  const [creditProgress, setCreditProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null)
  const awardMutOpts = awardManualCreditMutation()

  const handleAwardCredits = useCallback(async () => {
    if (attendeePersonIds.length === 0) {
      toast.error('No checked-in attendees to award credits to')
      return
    }

    const total = attendeePersonIds.length
    let done = 0
    const failed: string[] = []
    setCreditProgress({ done: 0, total, failed: [] })

    const results = await Promise.allSettled(
      attendeePersonIds.map(async (personId) => {
        try {
          await (awardMutOpts.mutationFn as any)({
            body: {
              personId,
              activityName: event.title,
              activityDate: new Date(event.startDate),
              creditAmount: event.creditAmount ?? 0,
              idempotencyKey: `${event.id}:${personId}`,
              cpdActivityType: event.cpdActivityType ?? undefined,
            },
          })
        } catch (err: any) {
          // 409 = already awarded (idempotency), treat as success
          if (err?.status === 409 || err?.statusCode === 409) return
          throw err
        } finally {
          done++
          setCreditProgress(prev => prev ? { ...prev, done } : null)
        }
      })
    )

    const actualFailed = results
      .map((r, i) => r.status === 'rejected' ? attendeePersonIds[i] : null)
      .filter(Boolean) as string[]

    if (actualFailed.length > 0) {
      setCreditProgress({ done: total, total, failed: actualFailed })
      toast.error(`${actualFailed.length} of ${total} credits failed. Use Retry.`)
    } else {
      setCreditProgress(null)
      markDone('creditsAwarded')
      toast.success(`${total} CPD credits awarded successfully`)
      queryClient.invalidateQueries({ queryKey: ['listMyCreditEntries'] })
    }
  }, [attendeePersonIds, awardMutOpts, event, queryClient])

  // --- Generate Certificates ---
  const [certsPending, setCertsPending] = useState(false)
  const certsMut = useMutation({
    ...bulkIssueCertificatesMutation(),
    onSuccess: (data: any) => {
      setCertsPending(false)
      markDone('certsGenerated')
      if (data?.status === 'queued') {
        toast.success(`Certificates queued for generation (${attendeePersonIds.length} attendees)`)
      } else {
        toast.success('Certificates generated successfully')
      }
      queryClient.invalidateQueries({ queryKey: ['listMyCertificates'] })
    },
    onError: (err: any) => {
      setCertsPending(false)
      toast.error(err?.body?.message ?? err?.message ?? 'Certificate generation failed')
    },
  })

  function handleGenerateCerts() {
    setCertsPending(true)
    certsMut.mutate({
      body: {
        organizationId: orgId,
        personIds: attendeePersonIds.slice(0, 100),
        trainingTitle: event.title,
        certificateType: 'attendance',
        signingOfficerId: userId,
        orgCode: orgSlug.toUpperCase(),
      },
    })
  }

  // --- Complete Event ---
  const completeMut = useMutation({
    ...completeEventMutation(),
    onSuccess: () => {
      toast.success('Event marked as completed')
      queryClient.invalidateQueries({ queryKey: getEventQueryKey({ path: { eventId: event.id }, headers: { 'x-org-id': orgId } }) })
      onEventCompleted?.()
    },
    onError: (err: any) => {
      toast.error(err?.body?.message ?? err?.message ?? 'Failed to complete event')
    },
  })

  function handleCompleteEvent() {
    completeMut.mutate({ path: { eventId: event.id } })
  }

  // --- Send Thank-You ---
  const [showThankYouDialog, setShowThankYouDialog] = useState(false)
  const [thankYouBody, setThankYouBody] = useState(
    `Dear Member,\n\nThank you for attending ${event.title}. We appreciate your participation and hope you found the event valuable.\n\nBest regards`
  )
  const createMsgMut = useMutation({ ...createMessageMutation() })
  const sendMsgMut = useMutation({ ...sendMessageMutation() })

  async function handleSendThankYou() {
    try {
      const created = await (createMsgMut.mutateAsync as any)({
        body: {
          channel: 'email',
          senderId: userId,
          recipientPersonIds: attendeePersonIds,
          subject: `Thank you for attending ${event.title}`,
          body: thankYouBody,
        },
      })
      const messageId = created?.data?.id ?? created?.id
      if (messageId) {
        await (sendMsgMut.mutateAsync as any)({ path: { messageId } })
      }
      markDone('thankYouSent')
      setShowThankYouDialog(false)
      toast.success('Thank-you message sent to all attendees')
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? 'Failed to send message')
    }
  }

  // --- Revoke Credits ---
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  async function handleRevokeCredits() {
    if (revokeReason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters')
      return
    }
    setRevoking(true)
    try {
      const csrfToken = readCsrfCookie()
      const res = await fetch('/api/association/member/credits/void-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { [CSRF_HEADER]: csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: event.id,
          activityName: event.title,
          personIds: attendeePersonIds,
          reason: revokeReason.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? `Failed (${res.status})`)
      }
      const result = await res.json()
      setCompletionState(event.id, 'creditsAwarded', false)
      setLocalCompletionState(prev => ({ ...prev, creditsAwarded: false }))
      setShowRevokeDialog(false)
      setRevokeReason('')
      toast.success(`${result.data?.voidedCount ?? 0} credits revoked`)
      queryClient.invalidateQueries({ queryKey: ['listMyCreditEntries'] })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to revoke credits')
    } finally {
      setRevoking(false)
    }
  }

  // --- Stats ---
  const totalRegistered = event.registrationCount ?? 0
  const totalCheckedIn = attendees.length
  const noShow = Math.max(0, totalRegistered - totalCheckedIn)
  const rate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0

  if (!isPast) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-[var(--color-muted)]">
          Post-event actions will be available after the event ends on{' '}
          {eventDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </p>
      </GlassCard>
    )
  }

  // Build checklist
  const checklist = [
    {
      id: 'attendance',
      label: 'Attendance finalized',
      description: `${totalCheckedIn} of ${totalRegistered} attendees checked in`,
      icon: <CheckCircle2 className="w-5 h-5" />,
      completed: totalCheckedIn > 0,
    },
    ...(event.creditBearing && event.creditAmount && event.creditAmount > 0 ? [
      {
        id: 'cpd',
        label: 'Award CPD credits',
        description: `${event.creditAmount} CPD credits (${event.cpdActivityType ?? 'General'}) to ${totalCheckedIn} attendees`,
        icon: <Award className="w-5 h-5" />,
        completed: creditsAwarded,
        action: creditsAwarded ? undefined : {
          label: creditProgress
            ? `Awarding... ${creditProgress.done}/${creditProgress.total}`
            : 'Award Credits to All Attendees',
          onClick: handleAwardCredits,
          disabled: !canAwardCredits || !!creditProgress || totalCheckedIn === 0,
          tooltip: !canAwardCredits ? 'Requires President, Secretary, or Treasurer role' : undefined,
        },
        retryAction: creditProgress?.failed && creditProgress.failed.length > 0 ? {
          label: `Retry ${creditProgress.failed.length} Failed`,
          onClick: handleAwardCredits,
        } : undefined,
      },
      {
        id: 'certificates',
        label: 'Generate certificates',
        description: `${totalCheckedIn} attendance certificates`,
        icon: <FileText className="w-5 h-5" />,
        completed: certsGenerated,
        action: certsGenerated ? undefined : {
          label: certsPending ? 'Generating...' : 'Generate Certificates',
          onClick: handleGenerateCerts,
          disabled: !canIssueCerts || certsPending || totalCheckedIn === 0,
          tooltip: !canIssueCerts ? 'Requires President or Secretary role' : undefined,
        },
      },
      ...(creditsAwarded ? [{
        id: 'revoke',
        label: 'Revoke awarded credits',
        description: `Void all CPD credits awarded for this event`,
        icon: <Undo2 className="w-5 h-5" />,
        completed: false,
        action: {
          label: 'Revoke Credits',
          onClick: () => setShowRevokeDialog(true),
          disabled: !canAwardCredits,
          variant: 'destructive' as const,
          tooltip: !canAwardCredits ? 'Requires President, Secretary, or Treasurer role' : undefined,
        },
      }] : []),
    ] : []),
    {
      id: 'thankyou',
      label: 'Send thank-you message',
      description: `Email to ${totalCheckedIn} attendees`,
      icon: <Mail className="w-5 h-5" />,
      completed: thankYouSent,
      action: thankYouSent ? undefined : {
        label: 'Compose Thank-You',
        onClick: () => setShowThankYouDialog(true),
        disabled: totalCheckedIn === 0,
      },
    },
    {
      id: 'complete',
      label: 'Mark event completed',
      description: isCompleted ? 'Event has been marked as completed' : 'Finalize this event',
      icon: <Flag className="w-5 h-5" />,
      completed: isCompleted,
      action: isCompleted ? undefined : {
        label: completeMut.isPending ? 'Completing...' : 'Complete Event',
        onClick: handleCompleteEvent,
        disabled: completeMut.isPending || (event.creditBearing ? !creditsAwarded : false),
        variant: 'default' as const,
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Attendance summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Registered" value={totalRegistered} />
        <StatCard label="Attended" value={totalCheckedIn} />
        <StatCard label="No-Show" value={noShow} />
        <StatCard label="Attendance Rate" value={`${rate}%`} />
      </div>

      {/* Post-event checklist */}
      <GlassCard className="p-6">
        <h3 className="text-h4 mb-4">Post-Event Checklist</h3>
        <div className="space-y-4">
          {checklist.map((item, index) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${item.completed ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
                {item.completed ? item.icon : <Circle className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${item.completed ? 'line-through text-[var(--color-muted)]' : ''}`}>
                  {index + 1}. {item.label}
                </span>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{item.description}</p>

                {item.action && !item.completed && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant={(item.action as any).variant ?? 'outline'}
                      size="sm"
                      disabled={item.action.disabled}
                      onClick={item.action.onClick}
                      title={(item.action as any).tooltip}
                    >
                      {(item.action.disabled && item.action.label.includes('...')) && (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      )}
                      {item.action.label}
                    </Button>
                    {(item as any).retryAction && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(item as any).retryAction.onClick}
                        className="text-[var(--color-error)]"
                      >
                        {(item as any).retryAction.label}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {event.creditBearing && !creditsAwarded && !isCompleted && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-surface-warm)] text-xs text-[var(--color-muted)]">
            <strong>Note:</strong> For credit-bearing events, CPD credits must be awarded before marking the event as completed.
          </div>
        )}
      </GlassCard>

      {/* Thank-you compose dialog */}
      <ConfirmDialog
        open={showThankYouDialog}
        onOpenChange={setShowThankYouDialog}
        title="Send Thank-You Message"
        description={`Send an email to ${totalCheckedIn} attendees`}
        confirmLabel={createMsgMut.isPending || sendMsgMut.isPending ? 'Sending...' : 'Send Message'}
        onConfirm={handleSendThankYou}
      >
        <div className="space-y-3 mt-3">
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">Subject</p>
            <p className="text-sm font-medium">Thank you for attending {event.title}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">Message</p>
            <Textarea
              value={thankYouBody}
              onChange={(e) => setThankYouBody(e.target.value)}
              rows={5}
              className="text-sm"
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* Revoke credits dialog */}
      <ConfirmDialog
        open={showRevokeDialog}
        onOpenChange={(open) => { setShowRevokeDialog(open); if (!open) setRevokeReason('') }}
        title="Revoke CPD Credits"
        description={`This will void all ${event.creditAmount ?? 0} CPD credits awarded to ${totalCheckedIn} attendees for this event. This action cannot be undone.`}
        confirmLabel={revoking ? 'Revoking...' : 'Revoke All Credits'}
        onConfirm={handleRevokeCredits}
        variant="irreversible"
        confirmText="REVOKE"
      >
        <div className="space-y-3 mt-3">
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">Reason for revocation (required, min 10 chars)</p>
            <Textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              placeholder="e.g., Credits were awarded to incorrect event, duplicate award..."
              className="text-sm"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
