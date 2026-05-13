import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@monobase/ui'
import { getStatusLabel } from '@/features/membership/lib/membership-status'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { CreditCard } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/id-card')({
  component: MyIdCard,
})

function IdCardSkeleton() {
  return (
    <div className="max-w-md mx-auto">
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full animate-shimmer bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)' }} />
          <div className="h-6 w-40 rounded-[8px] animate-shimmer bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)' }} />
          <div className="h-4 w-32 rounded-[8px] animate-shimmer bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)' }} />
        </div>
        <div className="space-y-3 pt-4 border-t border-[var(--color-border-light)]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 w-24 rounded-[8px] animate-shimmer bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)' }} />
              <div className="h-3.5 w-32 rounded-[8px] animate-shimmer bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)' }} />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

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
    <div>
      <PageHeader
        title="Digital ID Card"
        subtitle="Your verified member identification card"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'ID Card' },
        ]}
      />

      {isLoading ? (
        <IdCardSkeleton />
      ) : !membership ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          headline="No ID card available"
          description="Join an organization to get your digital member ID card."
        />
      ) : (
        <div className="max-w-md mx-auto">
          <GlassCard className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] mx-auto flex items-center justify-center text-[24px] font-bold font-display text-white">
                {initials}
              </div>
              <p className="font-bold font-display text-[20px]">{fullName || 'Member Name'}</p>
              <p className="text-[13px] text-[var(--color-muted)]">License: {license}</p>
            </div>
            <div className="border-t border-[var(--color-border-light)] pt-4 space-y-2 text-[14px]">
              <div className="flex justify-between"><span className="text-[var(--color-muted)]">Organization</span><span className="font-medium">{orgName}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-muted)]">Category</span><span className="font-medium">{category}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-muted)]">Status</span>
                {statusBadgeClass ? (
                  <Badge className={statusBadgeClass}>{statusLabel}</Badge>
                ) : (
                  <span>{statusLabel}</span>
                )}
              </div>
              <div className="flex justify-between"><span className="text-[var(--color-muted)]">Valid Until</span><span className="font-medium">{validUntil}</span></div>
            </div>
            <div className="border-t border-[var(--color-border-light)] pt-4 text-center">
              <div className="w-24 h-24 bg-[var(--color-surface-warm)] mx-auto rounded-[8px] flex items-center justify-center text-[12px] text-[var(--color-muted)]">QR Code</div>
              <p className="text-[12px] text-[var(--color-muted)] mt-2">Verified by Memberry</p>
            </div>
          </GlassCard>

          <div className="text-center mt-6">
            <button className="px-[22px] py-[10px] bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-semibold hover:bg-[var(--color-primary-mid)] transition-colors duration-150" disabled>
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
