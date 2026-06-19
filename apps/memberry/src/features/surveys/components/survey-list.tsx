import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  ClipboardList,
  BarChart3,
  Clock,
  FileText,
  Send,
  Lock,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Users,
  Copy,
} from 'lucide-react'
import { Skeleton, Tabs, TabsList, TabsTrigger, MenuItem, Button } from '@monobase/ui'
import { useOrg } from '@/hooks/use-org'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface SurveyRow {
  id: string
  title: string
  description?: string | null
  surveyType: 'nps' | 'satisfaction' | 'poll' | 'custom'
  status: 'draft' | 'active' | 'closed'
  anonymous: boolean
  deadline?: string | null
  responseCount: number
  questionCount: number
  createdAt: string
}

type TabFilter = 'all' | 'draft' | 'active' | 'closed'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: FileText },
  active: { label: 'Active', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', icon: Send },
  closed: { label: 'Closed', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', icon: Lock },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  nps: { label: 'NPS', color: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  satisfaction: { label: 'Satisfaction', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  poll: { label: 'Poll', color: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' },
  custom: { label: 'Custom', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600', icon: FileText }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SurveyList() {
  const { orgId, orgSlug } = useOrg()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabFilter>('all')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['surveys', orgId],
    queryFn: () => api.get<SurveyRow[]>(`/api/surveys?organizationId=${orgId}`),
  })

  const surveys = data ?? []

  const filtered = tab === 'all' ? surveys : surveys.filter((s) => s.status === tab)

  const counts = {
    all: surveys.length,
    draft: surveys.filter((s) => s.status === 'draft').length,
    active: surveys.filter((s) => s.status === 'active').length,
    closed: surveys.filter((s) => s.status === 'closed').length,
  }

  const publishMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/surveys/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', orgId] })
      toast.success('Survey published')
    },
    onError: () => toast.error('Failed to publish survey'),
  })

  const closeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/surveys/${id}`, { status: 'closed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', orgId] })
      toast.success('Survey closed')
    },
    onError: () => toast.error('Failed to close survey'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/surveys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', orgId] })
      toast.success('Survey deleted')
    },
    onError: () => toast.error('Failed to delete survey'),
  })

  const cloneMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/surveys/${id}/clone`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', orgId] })
      toast.success('Survey duplicated')
    },
    onError: () => toast.error('Failed to duplicate survey'),
  })

  // Stats row
  const stats = [
    { label: 'Total', value: counts.all, icon: ClipboardList },
    { label: 'Active', value: counts.active, icon: Send },
    { label: 'Drafts', value: counts.draft, icon: FileText },
    { label: 'Closed', value: counts.closed, icon: Lock },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="border rounded-lg p-4 flex items-center gap-3">
            <s.icon className="w-5 h-5 text-[var(--color-muted)]" />
            <div>
              <p className="text-[26px] font-bold font-display">{isLoading ? '\u2014' : s.value}</p>
              <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="all">All ({isLoading ? '\u2014' : counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({isLoading ? '\u2014' : counts.draft})</TabsTrigger>
          <TabsTrigger value="active">Active ({isLoading ? '\u2014' : counts.active})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({isLoading ? '\u2014' : counts.closed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">
          Failed to load surveys
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <ClipboardList className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="font-medium">No surveys yet</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Create your first survey to gather member feedback
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((survey) => (
            <div
              key={survey.id}
              className="flex items-center gap-4 border rounded-lg p-4 hover:bg-[var(--color-surface-warm)] transition-colors group relative"
            >
              <Link
                to="/org/$orgSlug/officer/surveys/$surveyId"
                params={{ orgSlug, surveyId: survey.id }}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={survey.surveyType} />
                  <StatusBadge status={survey.status} />
                  {survey.anonymous && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Anonymous
                    </span>
                  )}
                </div>
                <p className="font-medium truncate">{survey.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-muted)]">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {survey.responseCount} response{survey.responseCount !== 1 ? 's' : ''}
                  </span>
                  <span>{survey.questionCount} question{survey.questionCount !== 1 ? 's' : ''}</span>
                  {survey.deadline && <span>Due: {formatDate(survey.deadline)}</span>}
                  <span>Created {formatDate(survey.createdAt)}</span>
                </div>
              </Link>

              {/* Actions menu */}
              <div className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpenId(menuOpenId === survey.id ? null : survey.id)}
                  aria-label="Actions"
                >
                  <MoreHorizontal className="w-4 h-4 text-[var(--color-muted)]" />
                </Button>
                {menuOpenId === survey.id && (
                  <div className="absolute right-0 top-8 z-10 w-40 bg-popover border rounded-lg shadow-md py-1 text-sm">
                    {survey.status === 'draft' && (
                      <>
                        <MenuItem className="flex items-center gap-2" onClick={() => {
                            setMenuOpenId(null)
                            cloneMut.mutate(survey.id)
                          }}>
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </MenuItem>
                        <Link
                          to="/org/$orgSlug/officer/surveys/$surveyId"
                          params={{ orgSlug, surveyId: survey.id }}
                          className="block px-3 py-1.5 hover:bg-[var(--color-surface-warm)]"
                          onClick={() => setMenuOpenId(null)}
                        >
                          Edit
                        </Link>
                        <MenuItem onClick={() => {
                            setMenuOpenId(null)
                            publishMut.mutate(survey.id)
                          }}>
                          Publish
                        </MenuItem>
                        <MenuItem destructive onClick={() => {
                            setMenuOpenId(null)
                            deleteMut.mutate(survey.id)
                          }}>
                          Delete
                        </MenuItem>
                      </>
                    )}
                    {survey.status === 'active' && (
                      <>
                        <MenuItem className="flex items-center gap-2" onClick={() => {
                            setMenuOpenId(null)
                            cloneMut.mutate(survey.id)
                          }}>
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </MenuItem>
                        <Link
                          to="/org/$orgSlug/officer/surveys/$surveyId"
                          params={{ orgSlug, surveyId: survey.id }}
                          className="block px-3 py-1.5 hover:bg-[var(--color-surface-warm)]"
                          onClick={() => setMenuOpenId(null)}
                        >
                          View Results
                        </Link>
                        <MenuItem onClick={() => {
                            setMenuOpenId(null)
                            closeMut.mutate(survey.id)
                          }}>
                          Close Survey
                        </MenuItem>
                      </>
                    )}
                    {survey.status === 'closed' && (
                      <>
                        <MenuItem className="flex items-center gap-2" onClick={() => {
                            setMenuOpenId(null)
                            cloneMut.mutate(survey.id)
                          }}>
                          <Copy className="w-3.5 h-3.5" />
                          Duplicate
                        </MenuItem>
                        <Link
                          to="/org/$orgSlug/officer/surveys/$surveyId"
                          params={{ orgSlug, surveyId: survey.id }}
                          className="block px-3 py-1.5 hover:bg-[var(--color-surface-warm)]"
                          onClick={() => setMenuOpenId(null)}
                        >
                          View Results
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
