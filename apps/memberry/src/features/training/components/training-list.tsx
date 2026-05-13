import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BookOpen, Users, Award, Search, SlidersHorizontal } from 'lucide-react'
import { TrainingCard } from './training-card'
import {
  searchTrainingsOptions,
  searchTrainingsQueryKey,
  cancelCustomTrainingMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const TABS = [
  { key: 'published', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
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
  const [activeTab, setActiveTab] = useState('published')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const statusMap: Record<string, string> = { published: 'published', past: 'completed', draft: 'draft' }
  const apiStatus = statusMap[activeTab]

  const { data, isLoading } = useQuery(
    searchTrainingsOptions({
      query: {
        organizationId: orgId,
        status: apiStatus as any || undefined,
        type: typeFilter as any || undefined,
        q: search || undefined,
      },
    }),
  )

  const { data: pubData } = useQuery(
    searchTrainingsOptions({ query: { organizationId: orgId, status: 'published' as any, limit: 1 } }),
  )
  const { data: draftData } = useQuery(
    searchTrainingsOptions({ query: { organizationId: orgId, status: 'draft' as any, limit: 1 } }),
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
  })

  const trainings = (data?.data ?? []) as any[]
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
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
    {
      label: 'Enrollments',
      value: trainings.reduce((acc: number, t: any) => acc + (t.enrollmentCount ?? 0), 0),
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: 'CPE Credits Offered',
      value: trainings.reduce((acc: number, t: any) => acc + Number(t.creditAmount ?? 0), 0).toFixed(1),
      icon: Award,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
  ]

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
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search trainings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-xl h-52 bg-[var(--color-surface-warm)] animate-pulse" />
          ))}
        </div>
      ) : trainings.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-[var(--color-muted)]">
          No trainings found.{' '}
          <a href={`/org/${orgId}/officer/training/new`} className="text-[var(--color-primary)] hover:underline">
            Create one
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {trainings.map((t: any) => (
              <TrainingCard
                key={t.id}
                training={t}
                orgId={orgId}
                onCancel={(id) => {
                  if (confirm('Cancel this training?')) cancelMutation.mutate({ path: { trainingId: id }, query: { organizationId: orgId } })
                }}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--color-muted)] text-right">{total} total</p>
        </>
      )}
    </div>
  )
}
