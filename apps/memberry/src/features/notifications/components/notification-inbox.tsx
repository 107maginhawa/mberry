import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Bell, Megaphone, CreditCard, Calendar, BookOpen, Settings, CheckCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

type NotifCategory = 'All' | 'Announcements' | 'Payments' | 'Events' | 'Training' | 'System'

interface Notification {
  id: string
  title: string
  body: string
  category: NotifCategory
  read: boolean
  createdAt: Date
}

function mapTypeToCategory(type: string): NotifCategory {
  if (type === 'billing') return 'Payments'
  if (type.startsWith('booking.')) return 'Events'
  if (type.startsWith('comms.')) return 'Announcements'
  if (type.startsWith('training.') || type === 'training') return 'Training'
  if (type === 'system' || type === 'security') return 'System'
  return 'System'
}

function mapApiNotification(raw: any): Notification {
  return {
    id: raw.id,
    title: raw.title || 'Notification',
    body: raw.message || '',
    category: mapTypeToCategory(raw.type || 'system'),
    read: raw.status === 'read',
    createdAt: new Date(raw.createdAt || raw.sentAt || Date.now()),
  }
}

const CATEGORIES: NotifCategory[] = ['All', 'Announcements', 'Payments', 'Events', 'Training', 'System']

const CATEGORY_ICONS: Record<NotifCategory, React.ReactNode> = {
  All: <Bell size={13} />,
  Announcements: <Megaphone size={13} />,
  Payments: <CreditCard size={13} />,
  Events: <Calendar size={13} />,
  Training: <BookOpen size={13} />,
  System: <Settings size={13} />,
}

function getDateGroup(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 1) return 'Today'
  if (diffDays < 2) return 'Yesterday'
  if (diffDays < 7) return 'This Week'
  return 'Earlier'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

export function NotificationInbox() {
  const queryClient = useQueryClient()
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('All')

  const { data: notifications = [], isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const json = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      return (json.data || json.items || []).map(mapApiNotification) as Notification[]
    },
  })

  const error = fetchError ? 'Could not load notifications' : null

  const filtered = useMemo(() => {
    return activeCategory === 'All'
      ? notifications
      : notifications.filter((n) => n.category === activeCategory)
  }, [notifications, activeCategory])

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {}
    for (const n of filtered) {
      const group = getDateGroup(n.createdAt)
      if (!groups[group]) groups[group] = []
      groups[group].push(n)
    }
    return GROUP_ORDER.filter((g) => (groups[g]?.length ?? 0) > 0).map((g) => ({
      label: g,
      items: groups[g] ?? [],
    }))
  }, [filtered])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAllRead() {
    try {
      await api.post('/api/notifs/read-all')
    } catch { /* ignore */ }
    queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
      old?.map((n) => ({ ...n, read: true })) ?? []
    )
  }

  async function markRead(id: string) {
    try {
      await api.post(`/api/notifs/${id}/read`)
    } catch { /* ignore */ }
    queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
      old?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? []
    )
  }

  if (loading) {
    return <ListSkeleton rows={6} />
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-[12px] border border-[var(--color-error)]/20 bg-[var(--color-error)]/5 p-4 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-primary)] text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead} className="gap-1.5">
            <CheckCheck size={14} />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className="rounded-full gap-1.5"
          >
            {CATEGORY_ICONS[cat]}
            {cat}
          </Button>
        ))}
      </div>

      {/* Notification list */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} />}
          headline={notifications.length === 0 ? 'No notifications yet' : 'No notifications in this category'}
          description={notifications.length === 0 ? 'You\'ll see updates from your organizations here' : 'Try selecting a different category'}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <h3 className="text-section-label text-[var(--color-muted)] mb-2 px-1">
                {label}
              </h3>
              <GlassCard className="divide-y divide-[var(--color-border-light)] overflow-hidden">
                {items.map((n) => (
                  <NotifRow key={n.id} notification={n} onMarkRead={markRead} />
                ))}
              </GlassCard>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotifRow({
  notification: n,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const catIcon = CATEGORY_ICONS[n.category]

  return (
    <div
      className={`flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-surface-warm)] cursor-pointer ${
        !n.read ? 'border-l-[3px] border-l-[var(--color-primary)] bg-[var(--color-cream-light)]' : ''
      }`}
      onClick={() => !n.read && onMarkRead(n.id)}
    >
      <span
        className={`mt-0.5 shrink-0 p-1.5 rounded-full ${
          !n.read
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-border-light)] text-[var(--color-muted)]'
        }`}
      >
        {catIcon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-snug ${!n.read ? 'font-semibold' : 'font-medium text-[var(--color-muted)]'}`}>
            {n.title}
          </p>
          <span className="shrink-0 text-xs text-[var(--color-muted)] mt-0.5 whitespace-nowrap">
            {formatRelative(n.createdAt)}
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">{n.body}</p>
      </div>
    </div>
  )
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
