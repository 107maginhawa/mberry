import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Skeleton } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { InstitutionalMembershipForm } from '@/features/membership/components/institutional-membership-form'
import { SeatManagementPanel } from '@/features/membership/components/seat-management-panel'
import { useOrg } from '@/hooks/useOrg'
import { Trash2 } from 'lucide-react'
import {
  getInstitutionalMembershipOptions,
  deleteInstitutionalMembershipMutation,
  listInstitutionalMembershipsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/institutional-memberships/$institutionalMembershipId'
)({
  component: InstitutionalMembershipDetailPage,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  pendingPayment: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  gracePeriod: { label: 'Grace Period', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  lapsed: { label: 'Lapsed', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  suspended: { label: 'Suspended', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
}

function InstitutionalMembershipDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { institutionalMembershipId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDelete, setShowDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: membership, isLoading, error } = useQuery(
    getInstitutionalMembershipOptions({
      path: { institutionalMembershipId },
    })
  )

  const deleteMutOpts = deleteInstitutionalMembershipMutation()
  const deleteMut = useMutation({
    mutationFn: deleteMutOpts.mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listInstitutionalMembershipsQueryKey({ query: { organizationId: orgId } }) })
      toast.success('Institutional membership deleted')
      navigate({ to: '/org/$orgSlug/officer/institutional-memberships', params: { orgSlug } })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete membership')
      setIsDeleting(false)
    },
  })

  async function handleDelete() {
    setIsDeleting(true)
    await deleteMut.mutateAsync({ path: { institutionalMembershipId } })
  }

  const imBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Institutions', href: `/org/${orgSlug}/officer/institutional-memberships` },
  ]

  if (isLoading) {
    return (
      <PageShell title="Institutional Membership" breadcrumbs={imBreadcrumbs}>
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    )
  }

  if (error || !membership) {
    return (
      <PageShell title="Institutional Membership" breadcrumbs={imBreadcrumbs}>
        <div role="alert" className="p-10 text-center text-[var(--color-error)]">
          {error ? 'Failed to load institutional membership.' : 'Membership not found.'}
        </div>
      </PageShell>
    )
  }

  const statusBadge = STATUS_BADGE[membership.status] ?? { label: membership.status, className: 'bg-gray-100 text-gray-600' }

  return (
    <PageShell
      title="Institutional Membership"
      subtitle={`${membership.tierId} · ${membership.usedSeats}/${membership.totalSeats} seats`}
      breadcrumbs={[...imBreadcrumbs, { label: 'Detail' }]}
      actions={
        <div className="flex items-center gap-2">
          <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="text-[var(--color-error)] border-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={14} className="mr-1.5" />
            Delete
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
      {/* Edit form */}
      <div className="max-w-2xl">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Membership Details</h2>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">Edit the membership configuration below.</p>
        </div>
        <InstitutionalMembershipForm
          orgId={orgId}
          membership={membership}
          onSuccess={() => toast.success('Membership updated')}
        />
      </div>

      {/* Seat management */}
      <div className="max-w-3xl border-t pt-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Seat Management</h2>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">Allocate and revoke individual seats within this membership.</p>
        </div>
        <SeatManagementPanel
          institutionalMembershipId={institutionalMembershipId}
          orgId={orgId}
          totalSeats={membership.totalSeats}
          usedSeats={membership.usedSeats}
        />
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDelete} onOpenChange={(open) => { if (!open) setShowDelete(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Institutional Membership</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted)] py-2">
            Are you sure you want to delete this institutional membership? All seat allocations will be removed. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDelete(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Membership'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  )
}
