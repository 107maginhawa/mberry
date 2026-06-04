import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, Calendar, BookOpen, CheckCircle } from 'lucide-react'
import { listMyCustomTrainingsOptions, searchTrainingsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { ApiListResponse } from '@/types/api'
import { useOrgContext } from '@/hooks/useOrgContext'
import { useMyOrgs } from '@/hooks/useMyOrgs'
import { PageShell } from '@/components/patterns/page-shell'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton, TableSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { StatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'

export const Route = createFileRoute('/_authenticated/my/training')({
  component: MyTraining,
})

const ENROLLMENT_VARIANT: Record<string, StatusBadgeVariant> = {
  enrolled: 'success',
  pending_approval: 'warning',
  pending_payment: 'warning',
  waitlisted: 'info',
  rejected: 'error',
  cancelled: 'muted',
}

const TRAINING_VARIANT: Record<string, StatusBadgeVariant> = {
  draft: 'muted',
  published: 'success',
  cancelled: 'error',
  pending_approval: 'warning',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function MyTraining() {
  const { orgId } = useOrgContext()
  const navigate = useNavigate()
  const { orgs } = useMyOrgs()
  const orgSlug = orgId ? orgs.find((o) => o.organizationId === orgId)?.orgSlug : undefined
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

  interface TrainingItem { enrollment: { id: string; status: string }; training: { id: string; title: string; type?: string; startDate?: string; creditAmount?: number; status: string } }
  const rawItems: TrainingItem[] = (data as unknown as ApiListResponse<TrainingItem>)?.data ?? []
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
    <PageShell
      title="My Training"
      subtitle="Training sessions and courses you're enrolled in"
    >
      <div className="space-y-6">
      {/* Stats */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StaggerItem key={s.label}>
            <GlassCard className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold font-display" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.isFloat ? (
                    <CountUp value={s.value} format={(n) => n.toFixed(1)} />
                  ) : (
                    <CountUp value={s.value} />
                  )}
                </p>
                <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
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
      ) : error ? (
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load your training. Please try refreshing the page.
        </div>
      ) : items.length === 0 ? (
        // ui-c-exempt: empty-state-emphasis — no-training EmptyState
        <EmptyState
          icon={<BookOpen size={32} />}
          headline="No training sessions yet"
          description="Browse available trainings and enroll to start earning CPE credits."
          action={
            orgSlug
              ? { label: 'Browse training catalog', onClick: () => navigate({ to: '/org/$orgSlug/training', params: { orgSlug } }) }
              : { label: 'View my organizations', onClick: () => navigate({ to: '/my/organizations' }) }
          }
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <Table className="text-sm min-w-[700px]">
            <TableHeader className="bg-[var(--color-surface-warm)]">
              <TableRow>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Training</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Type</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Date</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Credits</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Enrollment</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.enrollment.id} className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
                  <TableCell className="px-4 py-3">
                    <p className="font-medium line-clamp-1">{item.training.title}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[var(--color-muted)] capitalize">
                    {item.training.type?.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[var(--color-muted)]">
                    {formatDate(item.training.startDate)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {Number(item.training.creditAmount) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        <Award className="w-3 h-3" />
                        {item.training.creditAmount} CPE
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <StatusBadge variant={ENROLLMENT_VARIANT[item.enrollment.status] ?? 'muted'}>
                      {item.enrollment.status.replace('_', ' ')}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <StatusBadge variant={TRAINING_VARIANT[item.training.status] ?? 'muted'}>
                      {item.training.status.replace('_', ' ')}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}

      {/* Network-wide available trainings (SO-9: cross-org promotion) */}
      {((availableData as unknown as ApiListResponse<{ id: string; title?: string; type?: string; startDate?: string; startAt?: string; creditAmount?: number; creditValue?: number }>)?.data ?? []).length > 0 && (
        <section>
          <h2 className="text-h4 mb-3">Available Trainings</h2>
          <p className="text-sm text-[var(--color-muted)] mb-4">Network-wide trainings from across all organizations</p>
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {((availableData as unknown as ApiListResponse<{ id: string; title?: string; type?: string; startDate?: string; startAt?: string; creditAmount?: number; creditValue?: number }>)?.data ?? []).slice(0, 6).map((t) => (
              <StaggerItem key={t.id}>
                <GlassCard className="p-4 hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
                  <p className="font-semibold text-sm line-clamp-1">{t.title}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-1 capitalize">{t.type?.replace('_', ' ')}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-muted)]">
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
    </PageShell>
  )
}
