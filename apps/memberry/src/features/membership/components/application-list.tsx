import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMembershipApplicationsOptions,
  listMembershipApplicationsQueryKey,
  approveMembershipApplicationMutation,
  denyMembershipApplicationMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronUp, ClipboardList, MessageSquare, X } from 'lucide-react'

interface ApplicationListProps {
  orgId: string
}

type AppStatus = 'pending' | 'approved' | 'rejected' | 'info_requested' | 'all'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  approved: { label: 'Approved', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  rejected: { label: 'Rejected', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  info_requested: { label: 'Info Requested', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
}

export function ApplicationList({ orgId }: ApplicationListProps) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<AppStatus>('pending')
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery(
    listMembershipApplicationsOptions({
      query: {
        organizationId: orgId,
        ...(statusFilter !== 'all' ? { status: statusFilter as any } : {}),
      },
    })
  )

  const rawApplications: any[] = data?.data ?? []
  const applications = [...rawApplications].sort((a, b) => {
    if (sortBy === 'name') return (a.name ?? a.personId ?? '').localeCompare(b.name ?? b.personId ?? '')
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  })

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

  const reviewMutation = {
    mutate: ({ appId, status, reason }: { appId: string; status: string; reason?: string }) => {
      if (status === 'approved') {
        approveMutation.mutate({ path: { applicationId: appId } })
      } else if (status === 'rejected') {
        denyMutation.mutate({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      } else if (status === 'info_requested') {
        denyMutation.mutate({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      }
    },
    mutateAsync: async ({ appId, status, reason }: { appId: string; status: string; reason?: string }) => {
      if (status === 'approved') {
        return approveMutation.mutateAsync({ path: { applicationId: appId } })
      } else if (status === 'rejected') {
        return denyMutation.mutateAsync({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      } else {
        return denyMutation.mutateAsync({ path: { applicationId: appId }, body: { denialReason: reason ?? '' } })
      }
    },
    isPending: approveMutation.isPending || denyMutation.isPending,
    variables: approveMutation.variables ?? denyMutation.variables,
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppStatus)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applications</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="info_requested">Info Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
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
          <span className="text-sm text-muted-foreground">
            {applications.length} result{applications.length !== 1 ? 's' : ''}
          </span>
        )}
        {selectedIds.size > 0 && statusFilter === 'pending' && (
          <Button
            size="sm"
            onClick={async () => {
              for (const id of selectedIds) {
                await reviewMutation.mutateAsync({ appId: id, status: 'approved' })
              }
              setSelectedIds(new Set())
            }}
            disabled={reviewMutation.isPending}
          >
            Approve {selectedIds.size} Selected
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center text-destructive">Failed to load applications. Please try again.</div>
      ) : applications.length === 0 ? (
        <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground border rounded-lg">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app: any) => (
            <div key={app.id} className="flex items-start gap-3">
              {statusFilter === 'pending' && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(app.id)}
                  onChange={(e) => {
                    const next = new Set(selectedIds)
                    e.target.checked ? next.add(app.id) : next.delete(app.id)
                    setSelectedIds(next)
                  }}
                  className="mt-5 h-4 w-4 rounded border-gray-300"
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
  app: any
  onReview: (status: string, reason?: string) => void
  isPending: boolean
}

function ApplicationCard({ app, onReview, isPending }: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [infoMode, setInfoMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [infoReason, setInfoReason] = useState('')

  const badge = STATUS_BADGE[app.status] ?? STATUS_BADGE['pending']!
  const canAct = ['pending', 'info_requested'].includes(app.status)

  function handleApprove() {
    setRejectMode(false)
    setInfoMode(false)
    onReview('approved')
  }

  function handleReject() {
    if (!rejectMode) {
      setInfoMode(false)
      setRejectMode(true)
    } else if (rejectReason.trim()) {
      onReview('rejected', rejectReason)
    }
  }

  function handleInfo() {
    if (!infoMode) {
      setRejectMode(false)
      setInfoMode(true)
    } else if (infoReason.trim()) {
      onReview('info_requested', infoReason)
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Card header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{app.name ?? app.personId ?? app.id}</div>
            <div className="text-xs text-muted-foreground truncate">{app.email ?? ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {app.categoryName && (
            <Badge variant="outline" className="hidden sm:inline-flex">{app.categoryName}</Badge>
          )}
          <Badge className={badge.className}>{badge.label}</Badge>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ''}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t bg-muted/10">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Category</p>
              <p className="font-medium">{app.categoryName ?? app.categoryId ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Applied</p>
              <p className="font-medium">
                {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
              </p>
            </div>
            {app.memberNumber && (
              <div>
                <p className="text-muted-foreground text-xs">Member #</p>
                <p className="font-mono text-xs">{app.memberNumber}</p>
              </div>
            )}
          </div>

          {app.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground text-xs mb-1">Notes</p>
              <p className="text-sm">{app.notes}</p>
            </div>
          )}

          {/* Reject reason textarea */}
          {rejectMode && (
            <div className="space-y-2">
              <Separator />
              <p className="text-sm font-medium">Reason for rejection</p>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Explain why this application is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Info request textarea */}
          {infoMode && (
            <div className="space-y-2">
              <Separator />
              <p className="text-sm font-medium">Information needed</p>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Specify what additional information is required..."
                value={infoReason}
                onChange={(e) => setInfoReason(e.target.value)}
                autoFocus
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
                onClick={handleReject}
                disabled={isPending || (rejectMode && !rejectReason.trim())}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {rejectMode ? 'Confirm Reject' : 'Reject'}
              </Button>
              <Button
                size="sm"
                variant={infoMode ? 'default' : 'outline'}
                onClick={handleInfo}
                disabled={isPending || (infoMode && !infoReason.trim())}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                {infoMode ? 'Send Request' : 'Request Info'}
              </Button>
              {(rejectMode || infoMode) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setRejectMode(false); setInfoMode(false) }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
