import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { ApiErrorBody } from '@/types/api'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Building2, ArrowRightLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/organizations')({
  component: MyOrganizationsPage,
})

function MyOrganizationsPage() {
  const queryClient = useQueryClient()
  const [leaveTarget, setLeaveTarget] = useState<{ membershipId: string; orgName: string; orgId: string } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [transferTarget, setTransferTarget] = useState<{ membershipId: string; orgId: string; orgName: string } | null>(null)

  // Normalize orgId field (API returns organizationId, some transforms use orgId)
  const normalizeOrgId = (m: any) => m.orgId ?? m.organizationId
  const [transferToOrgId, setTransferToOrgId] = useState('')
  const [transferring, setTransferring] = useState(false)

  const { data: memberships = [], isLoading: loading } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>('/api/persons/me/memberships')
      return res?.data || []
    },
  })

  async function handleLeaveConfirm() {
    if (!leaveTarget) return
    setLeaving(true)
    try {
      try {
        await api.post(
          `/api/association/member/memberships/${leaveTarget.membershipId}/terminate`,
          { terminationReason: 'voluntary_departure' },
          { 'x-org-id': leaveTarget.orgId },
        )
      } catch (err) {
        const body = err instanceof ApiError ? err.body as unknown as ApiErrorBody : {}
        toast.error(body?.error ?? 'Failed to leave organization. Please try again.')
        return
      }
      toast.success(`You have left ${leaveTarget.orgName}.`)
      queryClient.invalidateQueries({ queryKey: ['my-memberships'] })
      setLeaveTarget(null)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title="Organizations"
        subtitle="Your memberships across all organizations"
        actions={
          <Button
            variant="outline"
            onClick={() => toast.info('Organization discovery coming soon')}
          >
            Find Organizations
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : !memberships.length ? (
        <EmptyState
          icon={<Building2 size={40} />}
          headline="No memberships yet"
          description="Join a professional organization to access events, training, and credentials"
          action={{ label: 'Find Organizations', onClick: () => toast.info('Organization discovery coming soon') }}
        />
      ) : (
        <StaggerGrid className="space-y-3">
          {memberships.map((m: any) => (
            <StaggerItem key={m.id}>
            <div
              className="flex items-center gap-4 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-5 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all"
            >
              <Link
                to="/org/$orgSlug/members"
                params={{ orgSlug: normalizeOrgId(m) ?? '' }}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                <AvatarInitials name={m.orgName ?? 'Org'} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{m.orgName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {m.memberNumber && (
                      <span className="text-[13px] font-medium text-[var(--color-muted)]">#{m.memberNumber}</span>
                    )}
                  </div>
                  {m.duesExpiryDate && (
                    <p className="text-[13px] font-medium text-[var(--color-muted)] mt-1">
                      Dues expire: {new Date(m.duesExpiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={m.status ?? 'pending'} />
                {(m.status === 'grace' || m.status === 'lapsed' || m.status === 'gracePeriod') && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                  >
                    Pay Dues
                  </Button>
                )}
                {m.status !== 'terminated' && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setTransferTarget({ membershipId: m.id, orgId: normalizeOrgId(m), orgName: m.orgName ?? 'this organization' })}
                      aria-label="Transfer membership"
                    >
                      <ArrowRightLeft size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLeaveTarget({ membershipId: m.id, orgName: m.orgName ?? 'this organization', orgId: normalizeOrgId(m) })}
                      className="hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                    >
                      Leave
                    </Button>
                  </>
                )}
              </div>
            </div>
            </StaggerItem>
          ))}

          <p className="text-[13px] font-medium text-[var(--color-muted)] text-center mt-4">
            Each organization manages its own membership, dues, and credits independently.
          </p>
        </StaggerGrid>
      )}

      <ConfirmDialog
        open={!!leaveTarget && !leaving}
        onOpenChange={(open) => { if (!open && !leaving) setLeaveTarget(null) }}
        title={`Leave ${leaveTarget?.orgName ?? 'this organization'}?`}
        description="You will lose access to this organization's events, training, and resources. Your membership will be marked as terminated. To rejoin, you will need to apply again."
        confirmLabel="Leave Organization"
        onConfirm={handleLeaveConfirm}
        variant="destructive"
      />

      {/* Transfer membership dialog */}
      <Dialog
        open={!!transferTarget}
        onOpenChange={(open) => { if (!open) { setTransferTarget(null); setTransferToOrgId(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Membership</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[var(--color-muted)]">
            Transfer your membership from <strong>{transferTarget?.orgName}</strong> to another chapter in the same association.
          </p>
          <div className="space-y-2 py-2">
            <Label>Target Organization ID</Label>
            <Input
              value={transferToOrgId}
              onChange={(e) => setTransferToOrgId(e.target.value)}
              placeholder="Enter the target org ID or slug"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setTransferTarget(null); setTransferToOrgId(''); }}>
              Cancel
            </Button>
            <Button
              disabled={!transferToOrgId.trim() || transferring}
              onClick={async () => {
                if (!transferTarget) return
                setTransferring(true)
                try {
                  const personData = await api.get<any>('/api/persons/me')
                  const personId = personData?.id ?? personData?.data?.id
                  try {
                    await api.post(
                      '/api/association/member/affiliation-transfers',
                      {
                        personId,
                        fromChapterId: transferTarget.orgId,
                        toChapterId: transferToOrgId.trim(),
                      },
                      { 'x-org-id': transferTarget.orgId },
                    )
                  } catch (err) {
                    const body = err instanceof ApiError ? err.body as unknown as ApiErrorBody : {}
                    toast.error(body?.error ?? 'Transfer request failed')
                    return
                  }
                  toast.success('Transfer request submitted')
                  setTransferTarget(null)
                  setTransferToOrgId('')
                } catch {
                  toast.error('Something went wrong')
                } finally {
                  setTransferring(false)
                }
              }}
            >
              {transferring ? 'Submitting...' : 'Request Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
