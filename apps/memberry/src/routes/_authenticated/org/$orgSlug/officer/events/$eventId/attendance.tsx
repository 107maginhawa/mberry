import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Loader2, Users, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { listCustomEventRegistrationsOptions, listCustomEventRegistrationsQueryKey, checkInCustomEventMutation } from '@monobase/sdk-ts/generated/react-query'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/events/$eventId/attendance',
)({
  component: EventAttendance,
})

function EventAttendance() {
  const { orgId, orgSlug } = useOrg()
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()

  const queryOpts = listCustomEventRegistrationsOptions({ path: { eventId } })
  const regQueryKey = listCustomEventRegistrationsQueryKey({ path: { eventId } })

  const { data, isLoading, error } = useQuery(queryOpts)

  interface EventRegistration {
    id: string
    personId?: string
    memberId?: string
    memberName?: string
    personName?: string
    email?: string
    checkedIn?: boolean
  }

  const checkInMutOpts = checkInCustomEventMutation()
  const checkInMutation = useMutation<unknown, Error, EventRegistration, { previous: unknown }>({
    mutationFn: (reg) => (checkInMutOpts.mutationFn as (...args: unknown[]) => Promise<unknown>)({
      path: { eventId },
      body: { eventId, registrationId: reg.id, personId: reg.personId ?? reg.memberId, method: 'manual' as const },
    }),
    onMutate: async (reg) => {
      await queryClient.cancelQueries({ queryKey: regQueryKey })
      const previous = queryClient.getQueryData(regQueryKey)
      queryClient.setQueryData(regQueryKey, (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((r: EventRegistration) =>
            r.id === reg.id ? { ...r, checkedIn: true } : r
          ),
        }
      })
      return { previous }
    },
    onSuccess: () => {
      toast.success('Member checked in successfully')
    },
    onError: (err, _reg, context) => {
      if (context?.previous) queryClient.setQueryData(regQueryKey, context.previous)
      const apiErr = err as { body?: { message?: string }; message?: string }
      toast.error(apiErr?.body?.message ?? apiErr?.message ?? 'Check-in failed')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey })
    },
  })

  const registrations = (data?.data ?? []) as EventRegistration[]
  const presentCount = registrations.filter((r) => r.checkedIn).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Attendance"
        subtitle="Mark members as present for this event"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Events', href: `/org/${orgSlug}/officer/events` },
          { label: 'Attendance' },
        ]}
        actions={
          <GlassCard className="px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--color-muted)]" />
              <span className="text-[14px] font-medium">
                {presentCount} / {registrations.length} present
              </span>
            </div>
          </GlassCard>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <div className="p-6 text-center text-[var(--color-error)]">
          Failed to load registrations.
        </div>
      ) : registrations.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          headline="No registrations yet"
          description="Members who register for this event will appear here."
        />
      ) : (
        <GlassCard className="divide-y divide-[var(--color-border-light)]">
          {registrations.map((reg) => {
            const memberId = reg.memberId ?? reg.personId
            const isPresent = !!reg.checkedIn

            return (
              <div
                key={reg.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-warm)]/30"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isPresent}
                    disabled={isPresent || checkInMutation.isPending}
                    onCheckedChange={() => {
                      if (!isPresent) {
                        checkInMutation.mutate(reg)
                      }
                    }}
                  />
                  <div>
                    <p className="text-[14px] font-medium">
                      {reg.memberName ?? reg.personName ?? memberId}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {reg.email ?? `ID: ${memberId}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isPresent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <UserCheck className="w-3 h-3" /> Present
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkInMutation.isPending}
                      onClick={() => checkInMutation.mutate(reg)}
                    >
                      {checkInMutation.isPending &&
                      checkInMutation.variables?.memberId === memberId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Mark Present'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </GlassCard>
      )}
    </div>
  )
}
