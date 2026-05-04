import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BookOpen, Users, Award, TrendingUp, Search, SlidersHorizontal } from 'lucide-react'
import { TrainingCard } from './training-card'

const TABS = [
  { key: 'published', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_approval', label: 'Pending' },
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

  const queryKey = ['trainings', orgId, activeTab, typeFilter, search]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeTab !== 'past') params.set('status', activeTab)
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/training/list/${orgId}?${params}`)
      if (!res.ok) throw new Error('Failed to load trainings')
      return res.json() as Promise<{ data: any[]; meta: { total: number } }>
    },
  })

  const statsQuery = useQuery({
    queryKey: ['training-stats', orgId],
    queryFn: async () => {
      // Approximate from list counts
      const [pubRes, draftRes] = await Promise.all([
        fetch(`/api/training/list/${orgId}?status=published&limit=1`),
        fetch(`/api/training/list/${orgId}?status=draft&limit=1`),
      ])
      const [pub, draft] = await Promise.all([pubRes.json(), draftRes.json()])
      return {
        published: pub?.meta?.total ?? 0,
        drafts: draft?.meta?.total ?? 0,
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/training/cancel/${orgId}/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to cancel')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainings', orgId] }),
  })

  const trainings = data?.data ?? []
  const total = data?.meta?.total ?? 0

  const statCards = [
    {
      label: 'Published',
      value: statsQuery.data?.published ?? '—',
      icon: BookOpen,
      color: 'text-primary',
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
          <div key={s.label} className="border rounded-xl p-4 bg-card flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
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
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            <div key={i} className="border rounded-xl h-52 bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : trainings.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-muted-foreground">
          No trainings found.{' '}
          <a href={`/org/${orgId}/officer/training/new`} className="text-primary hover:underline">
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
                  if (confirm('Cancel this training?')) cancelMutation.mutate(id)
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">{total} total</p>
        </>
      )}
    </div>
  )
}
