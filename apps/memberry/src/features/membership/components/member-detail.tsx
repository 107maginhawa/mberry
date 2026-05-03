import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CreditCard, Mail, Phone, Shield, UserX } from 'lucide-react'

interface MemberDetailProps {
  orgId: string
  memberId: string
}

type MemberStatus = 'active' | 'gracePeriod' | 'lapsed' | 'suspended' | 'pendingPayment'

const STATUS_BADGE: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  gracePeriod: { label: 'Grace Period', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  lapsed: { label: 'Lapsed', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  suspended: { label: 'Suspended', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  pendingPayment: { label: 'Pending Payment', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
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
}

function getInitials(name: string | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function MemberDetail({ orgId, memberId }: MemberDetailProps) {
  const queryClient = useQueryClient()

  const [showChangeCat, setShowChangeCat] = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [suspendReason, setSuspendReason] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['membership-member', orgId, memberId],
    queryFn: async () => {
      const res = await fetch(`/api/membership/members/${orgId}/${memberId}`)
      if (!res.ok) throw new Error('Failed to fetch member')
      return (await res.json()).data
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['membership-categories', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/membership/categories/${orgId}`)
      if (!res.ok) throw new Error('Failed to fetch categories')
      return (await res.json()).data ?? []
    },
  })

  const categories: any[] = categoriesData ?? []

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/membership/members/${orgId}/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update member')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-member', orgId, memberId] })
      queryClient.invalidateQueries({ queryKey: ['membership-members', orgId] })
      setShowChangeCat(false)
      setShowSuspend(false)
      toast.success('Member updated')
    },
    onError: () => {
      toast.error('Update failed', { description: 'Please try again.' })
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
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

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        to="/org/$orgId/officer/roster"
        params={{ orgId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to roster
      </Link>

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
          <h1 className="text-2xl font-bold truncate">{member.name ?? 'Unknown Member'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {member.memberNumber && (
              <span className="font-mono text-xs text-muted-foreground border rounded px-1.5 py-0.5">
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
        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Contact</h2>
          {member.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${member.email}`} className="hover:underline truncate">{member.email}</a>
            </div>
          )}
          {member.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{member.phone}</span>
            </div>
          )}
          {!member.email && !member.phone && (
            <p className="text-sm text-muted-foreground">No contact info available.</p>
          )}
        </section>

        {/* Membership info */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Membership</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{member.categoryName ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium">
                {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Dues Expiry</dt>
              <dd className="font-medium">
                {member.duesExpiryDate ? new Date(member.duesExpiryDate).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd><Badge className={badge.className}>{badge.label}</Badge></dd>
            </div>
          </dl>
        </section>
      </div>

      <Separator />

      {/* Actions panel */}
      <section className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Actions</h2>
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
          {isSuspended ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate({ status: 'active' })}
              disabled={updateMutation.isPending}
            >
              <UserX className="h-4 w-4 mr-2" />
              Lift Suspension
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setShowSuspend(true)}
            >
              <UserX className="h-4 w-4 mr-2" />
              Suspend Member
            </Button>
          )}
        </div>
      </section>

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
              onClick={() => updateMutation.mutate({ categoryId: newCategoryId })}
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
            <textarea
              id="suspend-reason"
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe the reason for suspension..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => updateMutation.mutate({ status: 'suspended', suspendedReason: suspendReason })}
              disabled={!suspendReason.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Suspending...' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
