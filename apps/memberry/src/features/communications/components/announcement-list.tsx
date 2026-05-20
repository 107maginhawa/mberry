import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { api } from '@/lib/api'

interface AnnouncementListProps {
  orgId: string
}

type StatusTab = 'all' | 'sent' | 'scheduled' | 'draft' | 'archived'

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Archived' },
]

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  scheduled: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  sent: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  scheduled_failed: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  archived: 'bg-gray-100 text-gray-600',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function AnnouncementList({ orgId }: AnnouncementListProps) {
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', orgId, activeTab, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      if (search) params.set('search', search)
      return api.get<{ data: any[]; meta: { total: number } }>(`/api/communications/announcements/${orgId}?${params}`)
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['announcements-stats', orgId],
    queryFn: async () => {
      const sentJson = await api.get<any>(`/api/communications/announcements/${orgId}?status=sent&pageSize=1`)
      return { totalSent: sentJson.meta?.total ?? 0 }
    },
  })

  const announcements = data?.data ?? []
  const total = data?.meta?.total ?? 0
  const hasAnyPush = announcements.some((a: any) => a.channelPush)
  const hasAnyEmail = announcements.some((a: any) => a.channelEmail)
  const channelLabels = [hasAnyPush && 'Push', hasAnyEmail && 'Email'].filter(Boolean).join(' + ') || '—'

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-muted)]">Total Sent</p>
          <p className="text-[26px] font-bold font-display">{statsData?.totalSent ?? '—'}</p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-muted)]">Total</p>
          <p className="text-[26px] font-bold font-display">{total}</p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)] col-span-2 lg:col-span-1">
          <p className="text-sm text-[var(--color-muted)]">Channels Used</p>
          <p className="text-[26px] font-bold font-display">{channelLabels}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 border rounded-md p-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search announcements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-muted)]">
          {activeTab === 'all' && !search
            ? 'No announcements yet. Send your first message to members.'
            : 'No announcements match your filters.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {announcements.map((ann: any) => (
            <a
              key={ann.id}
              href={`/org/${orgId}/officer/communications/${ann.id}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{ann.title}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {ann.audienceType === 'all' ? 'All members' : 'Selected categories'}
                  {ann.channelPush && ' · Push'}
                  {ann.channelEmail && ' · Email'}
                </p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-sm text-[var(--color-muted)] hidden sm:block">
                  {formatDate(ann.publishedAt ?? ann.scheduledAt ?? ann.createdAt)}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_BADGE[ann.status] ?? ''}`}>
                  {ann.status.charAt(0).toUpperCase() + ann.status.slice(1).replace('_', ' ')}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
