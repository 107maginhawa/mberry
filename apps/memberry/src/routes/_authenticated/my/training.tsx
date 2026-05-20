import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, Calendar, BookOpen, CheckCircle } from 'lucide-react'
import { listMyCustomTrainingsOptions, searchTrainingsOptions } from '@monobase/sdk-ts/generated/react-query'
import { useOrgContext } from '@/hooks/useOrgContext'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton, TableSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'

export const Route = createFileRoute('/_authenticated/my/training')({
  component: MyTraining,
})

const STATUS_STYLES: Record<string, string> = {
  enrolled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  pending_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  waitlisted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
}

const TRAINING_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function MyTraining() {
  const { orgId } = useOrgContext()
  const orgHeaders = orgId ? { 'x-org-id': orgId } : undefined

  const { data, isLoading, error } = useQuery({
    ...listMyCustomTrainingsOptions(orgHeaders ? { headers: orgHeaders } : undefined),
    enabled: !!orgId,
  })

  // Network-wide trainings available for discovery (SO-9)
  const { data: availableData } = useQuery({
    ...searchTrainingsOptions({ query: { status: 'published' }, headers: orgHeaders }),
    enabled: !!orgId,
  })

  const rawItems: Array<{ enrollment: any; training: any }> = (data as any)?.data ?? []
  const items = rawItems.filter((i) => i.training && i.enrollment)

  const totalCredits = items.reduce((acc, item) => {
    const isCompleted = item.enrollment?.status === 'enrolled'
    return acc + (isCompleted ? Number(item.training?.creditAmount ?? 0) : 0)
  }, 0)

  const enrolled = items.filter((i) => i.enrollment?.status === 'enrolled').length
  const pending = items.filter((i) => ['pending_approval', 'pending_payment', 'waitlisted'].includes(i.enrollment?.status)).length

  const statCards = [
    { label: 'Enrolled', value: enrolled, icon: BookOpen, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10' },
    { label: 'Pending', value: pending, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20' },
    { label: 'CPE Credits', value: totalCredits, icon: Award, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', isFloat: true },
    { label: 'Completed', value: items.filter((i) => i.enrollment?.status === 'enrolled').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Training"
        subtitle="Training sessions and courses you're enrolled in"
      />

      {/* Stats */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StaggerItem key={s.label}>
            <GlassCard className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-[20px] font-bold font-display" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.isFloat ? (
                    <CountUp value={s.value} format={(n) => n.toFixed(1)} />
                  ) : (
                    <CountUp value={s.value} />
                  )}
                </p>
                <p className="text-[12px] text-[var(--color-muted)]">{s.label}</p>
              </div>
            </GlassCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error || items.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          headline="No training sessions yet"
          description="Browse available trainings and enroll to start earning CPE credits."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[700px]">
            <thead className="bg-[var(--color-surface-warm)]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Training</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Credits</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Enrollment</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.enrollment.id} className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1">{item.training.title}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)] capitalize">
                    {item.training.type?.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {formatDate(item.training.startDate)}
                  </td>
                  <td className="px-4 py-3">
                    {Number(item.training.creditAmount) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        <Award className="w-3 h-3" />
                        {item.training.creditAmount} CPE
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[item.enrollment.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {item.enrollment.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${TRAINING_STATUS_STYLES[item.training.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {item.training.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </GlassCard>
      )}

      {/* Network-wide available trainings (SO-9: cross-org promotion) */}
      {((availableData as any)?.data ?? []).length > 0 && (
        <section>
          <h2 className="text-h4 mb-3">Available Trainings</h2>
          <p className="text-[13px] text-[var(--color-muted)] mb-4">Network-wide trainings from across all organizations</p>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {((availableData as any)?.data ?? []).slice(0, 6).map((t: any) => (
              <StaggerItem key={t.id}>
                <GlassCard className="p-4 hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
                  <p className="font-semibold text-[14px] line-clamp-1">{t.title}</p>
                  <p className="text-[12px] text-[var(--color-muted)] mt-1 capitalize">{t.type?.replace('_', ' ')}</p>
                  <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--color-muted)]">
                    <span>{formatDate(t.startDate ?? t.startAt)}</span>
                    {Number(t.creditAmount ?? t.creditValue ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-medium">
                        <Award className="w-3 h-3" />
                        {t.creditAmount ?? t.creditValue} CPE
                      </span>
                    )}
                  </div>
                </GlassCard>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>
      )}
    </div>
  )
}
