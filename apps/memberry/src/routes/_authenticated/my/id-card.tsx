import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getStatusLabel } from '@/features/membership/lib/membership-status'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/my/id-card')({
  component: MyIdCard,
})

function MyIdCard() {
  const { data: person, isLoading: personLoading } = useQuery<any>({
    queryKey: ['my-person'],
    queryFn: () => api.get('/api/persons/me'),
  })

  const { data: memberships, isLoading: membershipsLoading } = useQuery<any>({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const json = await api.get<any>('/api/persons/me/memberships')
      return json.data ?? json
    },
  })

  const isLoading = personLoading || membershipsLoading
  const p = person?.data ?? person
  const membership = Array.isArray(memberships) ? memberships[0] : null

  const fullName = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : ''
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const license = p?.licenseNumber ?? p?.prcId ?? '—'
  const orgName = membership?.organizationName ?? membership?.orgName ?? membership?.memberNumber ?? '—'
  const category = membership?.categoryName ?? membership?.categoryId ?? '—'
  const status = membership?.status ?? '—'
  const statusLabel = typeof status === 'string' && status !== '—' ? getStatusLabel(status as any) : '—'
  const STATUS_BADGE_COLORS: Record<string, string> = {
    active: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    gracePeriod: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    lapsed: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    suspended: 'bg-gray-100 text-gray-800',
    pendingPayment: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  }
  const statusBadgeClass = typeof status === 'string' ? STATUS_BADGE_COLORS[status] ?? '' : ''
  const validUntil = membership?.duesExpiryDate
    ? new Date(membership.duesExpiryDate).toLocaleDateString()
    : '—'

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Digital ID Card</h1>
      <p className="text-sm text-muted-foreground">Your verified member identification card</p>

      <div className="max-w-md mx-auto border-2 rounded-xl p-6 space-y-4 bg-card">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="w-20 h-20 rounded-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] mx-auto flex items-center justify-center text-2xl font-bold text-white">
                {initials}
              </div>
              <p className="font-bold text-lg">{fullName || 'Member Name'}</p>
              <p className="text-sm text-muted-foreground">License: {license}</p>
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Organization</span><span className="font-medium">{orgName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{category}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                {statusBadgeClass ? (
                  <Badge className={statusBadgeClass}>{statusLabel}</Badge>
                ) : (
                  <span>{statusLabel}</span>
                )}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valid Until</span><span className="font-medium">{validUntil}</span></div>
            </div>
            <div className="border-t pt-4 text-center">
              <div className="w-24 h-24 bg-muted mx-auto rounded flex items-center justify-center text-xs text-muted-foreground">QR Code</div>
              <p className="text-xs text-muted-foreground mt-2">Verified by Memberry</p>
            </div>
          </>
        )}
      </div>

      <div className="text-center">
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium" disabled>
          Download PDF
        </button>
      </div>
    </div>
  )
}
