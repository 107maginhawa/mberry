import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  getRosterMemberOptions,
  getRosterMemberQueryKey,
  updateRosterMemberMutation,
  listRosterMembersQueryKey,
  listMembershipCategoriesOptions,
  reinstateMembershipMutation,
  terminateMembershipMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Avatar, AvatarFallback } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Separator } from '@monobase/ui'
import { Alert, AlertDescription } from '@monobase/ui'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CreditCard, Heart, Mail, Phone, RefreshCw, Shield, UserX } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { PageHeader } from '@/components/patterns/page-header'
import { ProfileSkeleton } from '@/components/patterns/skeleton-loader'

interface MemberDetailProps {
  orgId: string
  memberId: string
}

type MemberStatus = 'active' | 'gracePeriod' | 'lapsed' | 'suspended' | 'pendingPayment' | 'terminated'

const STATUS_BADGE: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  gracePeriod: { label: 'Grace Period', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  lapsed: { label: 'Lapsed', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  suspended: { label: 'Suspended', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  pendingPayment: { label: 'Pending Payment', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  terminated: { label: 'Terminated', className: 'bg-gray-200 text-gray-700 hover:bg-gray-200' },
}

const STATUS_BANNER: Partial<Record<MemberStatus, { message: string; className: string }>> = {
  gracePeriod: {
    message: 'This member is in their grace period. Dues are overdue but membership is still active.',
    className: 'border-yellow-300 bg-yellow-50 text-yellow-800',
  },
  lapsed: {
    message: 'Membership has lapsed. Member must renew to regain access to benefits.',
    className: 'border-red-300 bg-red-50 text-red-800',
  },
  suspended: {
    message: 'Membership is currently suspended.',
    className: 'border-gray-300 bg-gray-50 text-gray-800',
  },
  terminated: {
    message: 'Membership has been terminated.',
    className: 'border-gray-300 bg-gray-50 text-gray-700',
  },
}

function getInitials(name: string | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function MemberDetail({ orgId, memberId }: MemberDetailProps) {
  const queryClient = useQueryClient()

  const [showChangeCat, setShowChangeCat] = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDeceased, setShowDeceased] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [suspendReason, setSuspendReason] = useState('')

  // Cast to any: TypeSpec RosterMember type differs from hand-wired endpoint shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error } = useQuery(getRosterMemberOptions({ path: { memberId }, query: { organizationId: orgId } }) as any) as { data: any; isLoading: boolean; error: unknown }

  const { data: categoriesData } = useQuery(
    listMembershipCategoriesOptions({ query: { organizationId: orgId } })
  )

  const categories: any[] = categoriesData?.data ?? []

  const invalidateMember = () => {
    queryClient.invalidateQueries({ queryKey: getRosterMemberQueryKey({ path: { memberId }, query: { organizationId: orgId } }) })
    queryClient.invalidateQueries({ queryKey: listRosterMembersQueryKey({ query: { organizationId: orgId } }) })
  }

  const updateMutation = useMutation({
    ...updateRosterMemberMutation(),
    onSuccess: () => {
      invalidateMember()
      setShowChangeCat(false)
      setShowSuspend(false)
      toast.success('Member updated')
    },
    onError: () => {
      toast.error('Update failed', { description: 'Please try again.' })
    },
  })

  const reinstateMutation = useMutation({
    ...reinstateMembershipMutation(),
    onSuccess: () => {
      invalidateMember()
      toast.success('Membership reinstated')
    },
    onError: () => {
      toast.error('Reinstatement failed', { description: 'Please try again.' })
    },
  })

  const deceasedMutation = useMutation({
    ...terminateMembershipMutation(),
    onSuccess: () => {
      invalidateMember()
      setShowDeceased(false)
      toast.success('Member marked as deceased')
    },
    onError: () => {
      toast.error('Action failed', { description: 'Please try again.' })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <ProfileSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load member details.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const member = data
  const status = member.status as MemberStatus
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pendingPayment
  const banner = STATUS_BANNER[status]
  const isSuspended = status === 'suspended'
  const isTerminated = status === 'terminated'
  const canReinstate = isSuspended || isTerminated
  const canMarkDeceased = status === 'active' || status === 'gracePeriod' || status === 'lapsed'

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={member.name ?? 'Member Detail'}
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Roster', href: `/org/${orgId}/officer/roster` },
          { label: member.name ?? 'Member' },
        ]}
      />

      {/* Status warning banner */}
      {banner && (
        <Alert className={banner.className}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {banner.message}
            {isSuspended && member.suspendedReason && (
              <span className="block mt-1 font-medium">Reason: {member.suspendedReason}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 text-lg">
          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] font-bold font-display truncate">{member.name ?? 'Unknown Member'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {member.memberNumber && (
              <span className="font-mono text-xs text-[var(--color-muted)] border rounded px-1.5 py-0.5">
                {member.memberNumber}
              </span>
            )}
            {member.categoryName && (
              <Badge variant="outline">{member.categoryName}</Badge>
            )}
            <Badge className={badge.className}>{badge.label}</Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Two column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact info */}
        <GlassCard className="p-5 space-y-3">
          <h2 className="font-semibold text-[12px] uppercase tracking-wide text-[var(--color-muted)]">Contact</h2>
          {member.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-[var(--color-muted)] shrink-0" />
              <a href={`mailto:${member.email}`} className="hover:underline truncate">{member.email}</a>
            </div>
          )}
          {member.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-[var(--color-muted)] shrink-0" />
              <span>{member.phone}</span>
            </div>
          )}
          {!member.email && !member.phone && (
            <p className="text-sm text-[var(--color-muted)]">No contact info available.</p>
          )}
        </GlassCard>

        {/* Membership info */}
        <GlassCard className="p-5 space-y-3">
          <h2 className="font-semibold text-[12px] uppercase tracking-wide text-[var(--color-muted)]">Membership</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Category</dt>
              <dd className="font-medium">{member.categoryName ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Joined</dt>
              <dd className="font-medium">
                {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Dues Expiry</dt>
              <dd className="font-medium">
                {member.duesExpiryDate ? new Date(member.duesExpiryDate).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Status</dt>
              <dd><Badge className={badge.className}>{badge.label}</Badge></dd>
            </div>
          </dl>
        </GlassCard>
      </div>

      {/* Actions panel */}
      <GlassCard className="p-5 space-y-3">
        <h2 className="font-semibold text-[12px] uppercase tracking-wide text-[var(--color-muted)]">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowChangeCat(true)}>
            <Shield className="h-4 w-4 mr-2" />
            Change Category
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/org/$orgId/officer/payments/new"
              params={{ orgId }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </Link>
          </Button>
          {canReinstate && (
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => reinstateMutation.mutate({ path: { membershipId: member.id } })}
              disabled={reinstateMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {reinstateMutation.isPending ? 'Reinstating...' : 'Reinstate'}
            </Button>
          )}
          {!canReinstate && !isTerminated && (
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--color-error)] border-[var(--color-error)]/50 hover:bg-[var(--color-error)]/10"
              onClick={() => setShowSuspend(true)}
            >
              <UserX className="h-4 w-4 mr-2" />
              Suspend Member
            </Button>
          )}
          {canMarkDeceased && (
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--color-muted)] border-[var(--color-muted)]/30 hover:bg-[var(--color-surface-warm)]"
              onClick={() => setShowDeceased(true)}
            >
              <Heart className="h-4 w-4 mr-2" />
              Mark Deceased
            </Button>
          )}
        </div>
      </GlassCard>

      {/* Change Category dialog */}
      <Dialog open={showChangeCat} onOpenChange={setShowChangeCat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Membership Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Category</Label>
            <Select value={newCategoryId} onValueChange={setNewCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeCat(false)}>Cancel</Button>
            <Button
              onClick={() => (updateMutation as any).mutate({ path: { memberId }, body: { categoryId: newCategoryId } })}
              disabled={!newCategoryId || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="suspend-reason">Reason for suspension</Label>
            <Textarea
              id="suspend-reason"
              placeholder="Describe the reason for suspension..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => (updateMutation as any).mutate({ path: { memberId }, body: { status: 'suspended', suspendedReason: suspendReason } })}
              disabled={!suspendReason.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Suspending...' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Deceased dialog */}
      <Dialog open={showDeceased} onOpenChange={setShowDeceased}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Member as Deceased</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-[var(--color-muted)]">
              This will terminate the membership with reason &quot;deceased&quot;. This action cannot be undone without manual reinstatement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeceased(false)}>Cancel</Button>
            <Button
              variant="outline"
              className="text-[var(--color-muted)] border-[var(--color-muted)]/30 hover:bg-[var(--color-surface-warm)]"
              onClick={() => (deceasedMutation as any).mutate({ path: { membershipId: member.id }, body: { terminationReason: 'deceased' } })}
              disabled={deceasedMutation.isPending}
            >
              {deceasedMutation.isPending ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
