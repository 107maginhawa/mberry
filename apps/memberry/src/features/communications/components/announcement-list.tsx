import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

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
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  scheduled_failed: 'bg-red-100 text-red-800',
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
      const res = await fetch(`/api/communications/announcements/${orgId}?${params}`)
      if (!res.ok) throw new Error('Failed to load announcements')
      return res.json() as Promise<{ data: any[]; meta: { total: number } }>
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['announcements-stats', orgId],
    queryFn: async () => {
      const sentRes = await fetch(`/api/communications/announcements/${orgId}?status=sent&limit=1`)
      const sentJson = await sentRes.json()
      return { totalSent: sentJson.meta?.total ?? 0 }
    },
  })

  const announcements = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Total Sent</p>
          <p className="text-2xl font-bold">{statsData?.totalSent ?? '—'}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card col-span-2 lg:col-span-1">
          <p className="text-sm text-muted-foreground">Channels</p>
          <p className="text-2xl font-bold">Push + Email</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 border rounded-md p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
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
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
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
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{ann.title}</p>
                <p className="text-sm text-muted-foreground">
                  {ann.audienceType === 'all' ? 'All members' : 'Selected categories'}
                  {ann.channelPush && ' · Push'}
                  {ann.channelEmail && ' · Email'}
                </p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {formatDate(ann.publishedAt ?? ann.scheduledAt ?? ann.createdAt)}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ann.status] ?? ''}`}>
                  {ann.status}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
