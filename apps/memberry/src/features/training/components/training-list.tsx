import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button, Input } from '@monobase/ui'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { BookOpen, Users, Award, Search, SlidersHorizontal } from 'lucide-react'
import { TrainingCard } from './training-card'
import { EmptyState } from '@/components/patterns/empty-state'
import {
  searchTrainingsOptions,
  searchTrainingsQueryKey,
  cancelCustomTrainingMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { Training, TrainingStatus, TrainingType } from '@monobase/sdk-ts/generated/types.gen'

/** Server returns enrollment count as an aggregated field not present in the base Training type. */
interface TrainingWithCount extends Training {
  enrollmentCount?: number
}

const TABS = [
  { key: 'published', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'convention', label: 'Convention' },
  { value: 'online_course', label: 'Online Course' },
  { value: 'skills_training', label: 'Skills Training' },
]

interface TrainingListProps {
  orgId: string
}

export function TrainingList({ orgId }: TrainingListProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('published')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cancelTrainingId, setCancelTrainingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const statusMap: Record<string, string> = { published: 'published', past: 'completed', draft: 'draft' }
  const apiStatus = statusMap[activeTab]

  const { data, isLoading, error } = useQuery(
    searchTrainingsOptions({
      query: {
        organizationId: orgId,
        status: (apiStatus as TrainingStatus) || undefined,
        // UI offers broader type labels than the generated TrainingType union; cast to align
        type: (typeFilter !== 'all' ? typeFilter : undefined) as TrainingType | undefined,
        q: debouncedSearch || undefined,
      },
      headers: { 'x-org-id': orgId },
    }),
  )

  const { data: pubData } = useQuery(
    searchTrainingsOptions({ query: { organizationId: orgId, status: 'published' as TrainingStatus, limit: 1 }, headers: { 'x-org-id': orgId } }),
  )
  const { data: draftData } = useQuery(
    searchTrainingsOptions({ query: { organizationId: orgId, status: 'draft' as TrainingStatus, limit: 1 }, headers: { 'x-org-id': orgId } }),
  )
  const statsQuery = {
    data: {
      published: pubData?.pagination?.totalCount ?? 0,
      drafts: draftData?.pagination?.totalCount ?? 0,
    },
  }

  const cancelMutation = useMutation({
    ...cancelCustomTrainingMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: searchTrainingsQueryKey({ query: { organizationId: orgId } }) }),
    onError: (err) => toast.error(err.message || 'Failed to cancel training'),
  })

  const trainings = (data?.data ?? []) as unknown as TrainingWithCount[]
  const total = data?.pagination?.totalCount ?? 0

  const statCards = [
    {
      label: 'Published',
      value: statsQuery.data?.published ?? '—',
      icon: BookOpen,
      color: 'text-[var(--color-primary)]',
      bg: 'bg-primary/10',
    },
    {
      label: 'Drafts',
      value: statsQuery.data?.drafts ?? '—',
      icon: SlidersHorizontal,
      color: 'text-[var(--color-warning)]',
      bg: 'bg-[var(--color-warning-bg)]',
    },
    {
      label: 'Enrollments',
      value: trainings.reduce((acc: number, t) => acc + (t.enrollmentCount ?? 0), 0),
      icon: Users,
      color: 'text-[var(--color-info)]',
      bg: 'bg-[var(--color-info-bg)]',
    },
    {
      label: 'CPE Credits Offered',
      value: trainings.reduce((acc: number, t) => acc + Number(t.creditAmount ?? 0), 0).toFixed(1),
      icon: Award,
      color: 'text-[var(--color-warning)]',
      bg: 'bg-[var(--color-warning-bg)]',
    },
  ]

  if (error) {
    return (
      <div role="alert" aria-live="polite" className="text-sm text-[var(--color-error)] p-4 rounded-xl border border-destructive/20">
        Failed to load trainings.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="border rounded-xl p-4 bg-[var(--color-surface)] flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant="ghost"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-none ${
              activeTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <Input
            type="text"
            placeholder="Search trainings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="text-sm w-[160px]" aria-label="Filter trainings by type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-xl h-52 bg-[var(--color-surface-warm)] animate-pulse" />
          ))}
        </div>
      ) : trainings.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          headline="No trainings found"
          description="Create a new training session to get started."
          action={{
            label: 'Create training',
            onClick: () => navigate({ to: '/org/$orgSlug/officer/training/new', params: { orgSlug } }),
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {trainings.map((t) => (
              <TrainingCard
                key={t.id}
                training={t}
                orgId={orgId}
                onCancel={(id) => setCancelTrainingId(id)}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--color-muted)] text-right">{total} total</p>
        </>
      )}

      <ConfirmDialog
        open={cancelTrainingId !== null}
        onOpenChange={(open) => { if (!open) setCancelTrainingId(null) }}
        title="Cancel Training"
        description="Are you sure you want to cancel this training? Enrolled members will be notified."
        confirmLabel="Cancel Training"
        variant="destructive"
        onConfirm={() => {
          if (cancelTrainingId) cancelMutation.mutate({ path: { trainingId: cancelTrainingId }, query: { organizationId: orgId }, headers: { 'x-org-id': orgId } })
          setCancelTrainingId(null)
        }}
      />
    </div>
  )
}
