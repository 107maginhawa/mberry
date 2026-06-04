import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, RefreshCw, BarChart3, Users, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'
import { ErrorState } from '@/components/skeletons'

export const Route = createFileRoute('/surveys/' as any)({
  component: () => (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <SurveysPage />
    </RequireRole>
  ),
})

interface AdminSurvey {
  id: string
  title: string
  organizationName?: string
  surveyType: string
  status: string
  responseCount: number
  questionCount: number
  npsScore?: number | null
  createdAt: string
}

interface SurveyStats {
  totalSurveys: number
  activeSurveys: number
  avgNps: number | null
  avgResponseRate: number
}

const LIMIT = 25

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-800',
  closed: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-100 text-gray-500',
}

const TYPE_COLORS: Record<string, string> = {
  nps: 'bg-blue-100 text-blue-800',
  satisfaction: 'bg-green-100 text-green-800',
  poll: 'bg-purple-100 text-purple-800',
  custom: 'bg-orange-100 text-orange-800',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function SurveysPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  // Fetch surveys — admin sees all orgs
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-surveys', statusFilter, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('surveyType', typeFilter)

      const res = await fetch(`/api/admin/surveys?${params}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch surveys')
      return res.json() as Promise<{ data: AdminSurvey[]; total: number; stats: SurveyStats }>
    },
  })

  if (isError) {
    return (
      <PageShell title="Surveys" maxWidth="full">
        <ErrorState message="Could not load surveys" onRetry={() => refetch()} />
      </PageShell>
    )
  }

  const surveys = data?.data ?? []
  const total = data?.total ?? 0
  const stats = data?.stats
  const totalPages = Math.ceil(total / LIMIT)

  const statCards = [
    { label: 'Total Surveys', value: stats?.totalSurveys ?? '—', icon: ClipboardList },
    { label: 'Active', value: stats?.activeSurveys ?? '—', icon: TrendingUp },
    { label: 'Avg NPS', value: stats?.avgNps != null ? `${stats.avgNps > 0 ? '+' : ''}${stats.avgNps.toFixed(0)}` : '—', icon: BarChart3 },
    { label: 'Avg Response Rate', value: stats?.avgResponseRate != null ? `${stats.avgResponseRate.toFixed(0)}%` : '—', icon: Users },
  ]

  return (
    <PageShell
      title="Surveys"
      subtitle="Cross-organization survey analytics and monitoring"
      maxWidth="full"
      actions={
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="border rounded-lg p-4 flex items-center gap-3">
            <s.icon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="nps">NPS</SelectItem>
            <SelectItem value="satisfaction">Satisfaction</SelectItem>
            <SelectItem value="poll">Poll</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Survey</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Responses</TableHead>
              <TableHead className="text-right">NPS</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-6 bg-muted rounded animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : surveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No surveys found
                </TableCell>
              </TableRow>
            ) : (
              surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {survey.questionCount} question{survey.questionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {survey.organizationName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[survey.surveyType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {survey.surveyType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[survey.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {survey.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {survey.responseCount}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {survey.npsScore != null
                      ? `${survey.npsScore > 0 ? '+' : ''}${survey.npsScore.toFixed(0)}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(survey.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * LIMIT >= total}
          >
            Next
          </Button>
        </div>
      )}
    </PageShell>
  )
}
