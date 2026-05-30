import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMembershipApplicationsOptions,
  listMembershipApplicationsQueryKey,
  approveMembershipApplicationMutation,
  denyMembershipApplicationMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { ApplicationStatus, MembershipApplication } from '@monobase/sdk-ts/generated/types.gen'
import { CSRF_HEADER, readCsrfCookie } from '@monobase/sdk-ts/csrf'

/**
 * Hand-wired endpoint enriches MembershipApplication with display fields
 * not in the TypeSpec (name, email, categoryName, appliedAt, avatar).
 */
type ApplicationRow = MembershipApplication & {
  name?: string
  email?: string
  categoryName?: string
  categoryId?: string
  appliedAt?: string | Date
  memberNumber?: string
  notes?: string
  avatar?: { url: string }
}
import { Button } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Separator } from '@monobase/ui'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronUp, ClipboardList, X } from 'lucide-react'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

interface ApplicationListProps {
  orgId: string
}

// TypeSpec ApplicationStatus enum values: submitted, underReview, approved, denied, waitlisted
type AppStatus = 'submitted' | 'underReview' | 'approved' | 'denied' | 'waitlisted' | 'all'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  underReview: { label: 'Under Review', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  approved: { label: 'Approved', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  denied: { label: 'Denied', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  waitlisted: { label: 'Waitlisted', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
}

// Approvable statuses for bulk approve
const APPROVABLE_STATUSES: AppStatus[] = ['submitted', 'underReview']

export function ApplicationList({ orgId }: ApplicationListProps) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<AppStatus>('submitted')
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery(
    listMembershipApplicationsOptions({
      query: {
        organizationId: orgId,
        ...(statusFilter !== 'all' ? { status: statusFilter as ApplicationStatus } : {}),
      },
    })
  )

  const rawApplications: ApplicationRow[] = data?.data as ApplicationRow[] ?? []
  const applications = [...rawApplications].sort((a: ApplicationRow, b: ApplicationRow) => {
    if (sortBy === 'name') return (a.name ?? a.personId ?? '').localeCompare(b.name ?? b.personId ?? '')
    return new Date(b.appliedAt ?? b.applicationDate ?? 0).getTime() - new Date(a.appliedAt ?? a.applicationDate ?? 0).getTime()
  })

  // Applications that can be approved (submitted or underReview)
  const approvableApplications = applications.filter((app) =>
    APPROVABLE_STATUSES.includes(app.status as AppStatus)
  )

  const invalidateApplications = () => {
    queryClient.invalidateQueries({
      queryKey: listMembershipApplicationsQueryKey({ query: { organizationId: orgId } }),
    })
  }

  const approveMutation = useMutation({
    ...approveMembershipApplicationMutation(),
    onSuccess: () => {
      invalidateApplications()
      toast.success('Application approved')
    },
    onError: () => {
      toast.error('Action failed', { description: 'Please try again.' })
    },
  })

  const denyMutation = useMutation({
    ...denyMembershipApplicationMutation(),
    onSuccess: () => {
      invalidateApplications()
      toast.success('Application rejected')
    },
    onError: () => {
      toast.error('Action failed', { description: 'Please try again.' })
    },
  })

  // Bulk approve mutation — calls POST /api/association/member/applications/bulk-approve
  // The SDK does not yet have a generated hook (endpoint added in plan 03 backend,
  // codegen not re-run), so we call the API directly via the Vite proxy.
  const bulkApprove = useMutation({
    mutationFn: async ({ applicationIds }: { applicationIds: string[] }) => {
      const csrfToken = readCsrfCookie()
      const response = await fetch('/api/association/member/applications/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { [CSRF_HEADER]: csrfToken } : {}),
        },
        body: JSON.stringify({ applicationIds }),
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Bulk approve failed: ${response.status}`)
      }
      return response.json() as Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>
    },
    onSuccess: (data) => {
      const { succeeded, failed } = data
      if (failed.length === 0) {
        toast.success(`${succeeded.length} application${succeeded.length !== 1 ? 's' : ''} approved`)
      } else if (succeeded.length === 0) {
        toast.error(`All ${failed.length} approval${failed.length !== 1 ? 's' : ''} failed`)
      } else {
        toast.warning(`${succeeded.length} approved, ${failed.length} failed`)
      }
      // Show individual failure reasons for partial failures
      failed.forEach((f) => toast.error(`${f.id.slice(0, 8)}...: ${f.reason}`))
      setSelectedIds(new Set())
      invalidateApplications()
    },
    onError: () => {
      toast.error('Bulk approve failed', { description: 'Please try again.' })
    },
  })

  const reviewMutation = {
    mutate: ({ appId, status, reason }: { appId: string; status: string; reason?: string }) => {
      if (status === 'approved') {
        approveMutation.mutate({ path: { applicationId: appId } })
      } else if (status === 'denied') {
        denyMutation.mutate({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      }
    },
    mutateAsync: async ({ appId, status, reason }: { appId: string; status: string; reason?: string }) => {
      if (status === 'approved') {
        return approveMutation.mutateAsync({ path: { applicationId: appId } })
      } else {
        return denyMutation.mutateAsync({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      }
    },
    isPending: approveMutation.isPending || denyMutation.isPending,
    variables: approveMutation.variables ?? denyMutation.variables,
  }

  // Select All toggle for approvable applications
  const allApprovableSelected =
    approvableApplications.length > 0 &&
    approvableApplications.every((app) => selectedIds.has(app.id))

  const toggleSelectAll = () => {
    if (allApprovableSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(approvableApplications.map((app) => app.id)))
    }
  }

  const canBulkApprove = APPROVABLE_STATUSES.includes(statusFilter)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Select All checkbox for bulk approve */}
        {canBulkApprove && approvableApplications.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allApprovableSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all approvable applications"
            />
            <span className="text-sm text-[var(--color-muted)]">All</span>
          </div>
        )}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as AppStatus); setSelectedIds(new Set()) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applications</SelectItem>
            <SelectItem value="submitted">Pending</SelectItem>
            <SelectItem value="underReview">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'name')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest first</SelectItem>
            <SelectItem value="name">By name</SelectItem>
          </SelectContent>
        </Select>
        {!isLoading && (
          <span className="text-sm text-[var(--color-muted)]">
            {applications.length} result{applications.length !== 1 ? 's' : ''}
          </span>
        )}
        {/* Bulk approve button — shown when applications are selected */}
        {selectedIds.size > 0 && canBulkApprove && (
          <Button
            size="sm"
            onClick={() => bulkApprove.mutate({ applicationIds: [...selectedIds] })}
            disabled={bulkApprove.isPending}
          >
            {bulkApprove.isPending
              ? 'Approving...'
              : `Approve ${selectedIds.size} Selected`}
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <GlassCard className="p-10 text-center text-[var(--color-error)]">Failed to load applications. Please try again.</GlassCard>
      ) : applications.length === 0 ? (
        <GlassCard className="p-0">
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            headline="No applications found"
            description="Applications matching your filter will appear here."
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {applications.map((app: ApplicationRow) => (
            <div key={app.id} className="flex items-start gap-3">
              {canBulkApprove && APPROVABLE_STATUSES.includes(app.status as AppStatus) && (
                <Checkbox
                  checked={selectedIds.has(app.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedIds)
                    if (checked) { next.add(app.id) } else { next.delete(app.id) }
                    setSelectedIds(next)
                  }}
                  className="mt-5"
                  aria-label={`Select ${app.name ?? app.id}`}
                />
              )}
              <div className="flex-1">
                <ApplicationCard
                  app={app}
                  onReview={(status, reason) =>
                    reviewMutation.mutate({ appId: app.id, status, reason })
                  }
                  isPending={reviewMutation.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ApplicationCardProps {
  app: ApplicationRow
  onReview: (status: string, reason?: string) => void
  isPending: boolean
}

function ApplicationCard({ app, onReview, isPending }: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const badge = STATUS_BADGE[app.status] ?? STATUS_BADGE['pending']!
  const canAct = ['submitted', 'underReview'].includes(app.status)

  function handleApprove() {
    setRejectMode(false)
    onReview('approved')
  }

  function handleDeny() {
    if (!rejectMode) {
      setRejectMode(true)
    } else if (rejectReason.trim()) {
      onReview('denied', rejectReason)
    }
  }

  return (
    <GlassCard className="overflow-hidden">
      {/* Card header */}
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between px-4 py-3 h-auto text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AvatarInitials
            name={app.name ?? '?'}
            size="sm"
            photoUrl={app.avatar?.url}
          />
          <div className="min-w-0">
            <div className="font-medium truncate">{app.name ?? app.personId ?? app.id}</div>
            <div className="text-xs text-[var(--color-muted)] truncate">{app.email ?? ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {app.categoryName && (
            <Badge variant="outline" className="hidden sm:inline-flex">{app.categoryName}</Badge>
          )}
          <Badge className={badge.className}>{badge.label}</Badge>
          <span className="text-xs text-[var(--color-muted)] hidden sm:block">
            {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ''}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-[var(--color-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-muted)]" />}
        </div>
      </Button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[var(--color-surface-border-glass)]">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-[var(--color-muted)] text-xs">Category</p>
              <p className="font-medium">{app.categoryName ?? app.categoryId ?? '—'}</p>
            </div>
            <div>
              <p className="text-[var(--color-muted)] text-xs">Applied</p>
              <p className="font-medium">
                {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
              </p>
            </div>
            {app.memberNumber && (
              <div>
                <p className="text-[var(--color-muted)] text-xs">Member #</p>
                <p className="font-mono text-xs">{app.memberNumber}</p>
              </div>
            )}
          </div>

          {app.notes && (
            <div className="text-sm">
              <p className="text-[var(--color-muted)] text-xs mb-1">Notes</p>
              <p className="text-sm">{app.notes}</p>
            </div>
          )}

          {/* Denial reason textarea */}
          {rejectMode && (
            <div className="space-y-2">
              <Separator />
              <p className="text-sm font-medium">Reason for denial</p>
              <Textarea
                placeholder="Explain why this application is being denied..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
                className="min-h-[72px] resize-none"
              />
            </div>
          )}

          {/* Action buttons */}
          {canAct && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant={rejectMode ? 'destructive' : 'outline'}
                onClick={handleDeny}
                disabled={isPending || (rejectMode && !rejectReason.trim())}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {rejectMode ? 'Confirm Deny' : 'Deny'}
              </Button>
              {rejectMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRejectMode(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}
