import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, ArrowRightLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/organizations')({
  component: MyOrganizationsPage,
})

function MyOrganizationsPage() {
  const [memberships, setMemberships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [leaveTarget, setLeaveTarget] = useState<{ membershipId: string; orgName: string; orgId: string } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [transferTarget, setTransferTarget] = useState<{ membershipId: string; orgId: string; orgName: string } | null>(null)
  const [transferToOrgId, setTransferToOrgId] = useState('')
  const [transferring, setTransferring] = useState(false)

  const fetchMemberships = useCallback(() => {
    fetch('/api/persons/me/memberships')
      .then(res => res.json())
      .then(res => {
        setMemberships(res?.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchMemberships() }, [fetchMemberships])

  async function handleLeaveConfirm() {
    if (!leaveTarget) return
    setLeaving(true)
    try {
      const res = await fetch(
        `/api/association/member/memberships/${leaveTarget.membershipId}/terminate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-org-id': leaveTarget.orgId },
          body: JSON.stringify({ terminationReason: 'voluntary_departure' }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? 'Failed to leave organization. Please try again.')
        return
      }
      toast.success(`You have left ${leaveTarget.orgName}.`)
      setMemberships(prev => prev.filter(m => m.id !== leaveTarget.membershipId))
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
          <button className="px-[22px] py-[10px] rounded-[8px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150">
            Find Organizations
          </button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : !memberships.length ? (
        <EmptyState
          icon={<Building2 size={40} />}
          headline="No memberships yet"
          description="Join a professional organization to access events, training, and credentials"
          action={{ label: 'Find Organizations', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {memberships.map((m: any) => (
            <div
              key={m.id}
              className="flex items-center gap-4 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 hover:shadow-soft transition-shadow"
            >
              <Link
                to="/org/$orgId/members"
                params={{ orgId: m.orgId }}
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
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                    className="px-4 py-[7px] rounded-[8px] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-mid)] transition-colors duration-150"
                  >
                    Pay Dues
                  </button>
                )}
                {m.status !== 'terminated' && (
                  <>
                    <button
                      onClick={() => setTransferTarget({ membershipId: m.id, orgId: m.orgId, orgName: m.orgName ?? 'this organization' })}
                      className="px-3 py-[7px] rounded-[8px] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors duration-150"
                      title="Transfer membership"
                    >
                      <ArrowRightLeft size={14} />
                    </button>
                    <button
                      onClick={() => setLeaveTarget({ membershipId: m.id, orgName: m.orgName ?? 'this organization', orgId: m.orgId })}
                      className="px-3 py-[7px] rounded-[8px] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-muted)] hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors duration-150"
                      title="Leave organization"
                    >
                      Leave
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          <p className="text-[13px] font-medium text-[var(--color-muted)] text-center mt-4">
            Each organization manages its own membership, dues, and credits independently.
          </p>
        </div>
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
                  const personRes = await fetch('/api/persons/me', { credentials: 'include' })
                  const personData = await personRes.json()
                  const personId = personData?.id ?? personData?.data?.id
                  const res = await fetch('/api/association/member/affiliation-transfers', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'x-org-id': transferTarget.orgId },
                    body: JSON.stringify({
                      personId,
                      fromChapterId: transferTarget.orgId,
                      toChapterId: transferToOrgId.trim(),
                    }),
                  })
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
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
