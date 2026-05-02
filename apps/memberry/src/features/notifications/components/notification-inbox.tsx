import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, Megaphone, CreditCard, Calendar, BookOpen, Settings, CheckCheck } from 'lucide-react'

type NotifCategory = 'All' | 'Announcements' | 'Payments' | 'Events' | 'Training' | 'System'

interface Notification {
  id: string
  title: string
  body: string
  category: NotifCategory
  read: boolean
  createdAt: Date
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Your dues payment was received',
    body: 'Payment of ₱1,200 for PDA Manila Chapter has been confirmed.',
    category: 'Payments',
    read: false,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'Annual Convention 2026 — Registration now open',
    body: 'Join us at the SMX Convention Center on June 12–14, 2026.',
    category: 'Events',
    read: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: '3',
    title: 'Board announcement: New membership categories',
    body: 'The board has approved two new membership tiers effective Q3 2026.',
    category: 'Announcements',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: '4',
    title: 'CPD Training: Implant Dentistry Basics',
    body: 'A new 3-credit CPD training is available. Enroll before May 30.',
    category: 'Training',
    read: true,
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
  },
  {
    id: '5',
    title: 'Invoice #INV-2026-0042 is now due',
    body: 'Your renewal invoice of ₱1,500 is due on May 15, 2026.',
    category: 'Payments',
    read: true,
    createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
  },
  {
    id: '6',
    title: 'Regional Summit — Early bird closes May 10',
    body: 'Secure your seat at the Southern Luzon Regional Summit.',
    category: 'Events',
    read: true,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: '7',
    title: 'Welcome to Memberry',
    body: 'Your account has been set up. Complete your profile to get started.',
    category: 'System',
    read: true,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: '8',
    title: 'Monthly newsletter: April 2026',
    body: 'Read the latest news and updates from the association.',
    category: 'Announcements',
    read: true,
    createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
  },
]

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
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('All')

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

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-[var(--color-primary)] text-white">
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
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
              activeCategory === cat
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            }`}
          >
            {CATEGORY_ICONS[cat]}
            {cat}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {grouped.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border-light)] p-10 text-center text-[var(--color-muted)]">
          No notifications in this category
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-muted)] mb-2 px-1">
                {label}
              </h3>
              <div className="rounded-[12px] border border-[var(--color-border-light)] divide-y divide-[var(--color-border-light)] overflow-hidden">
                {items.map((n) => (
                  <NotifRow key={n.id} notification={n} onMarkRead={markRead} />
                ))}
              </div>
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
          <p className={`text-[14px] leading-snug ${!n.read ? 'font-semibold' : 'font-medium text-[var(--color-muted)]'}`}>
            {n.title}
          </p>
          <span className="shrink-0 text-[11px] text-[var(--color-muted)] mt-0.5 whitespace-nowrap">
            {formatRelative(n.createdAt)}
          </span>
        </div>
        <p className="text-[12px] text-[var(--color-muted)] mt-1 line-clamp-2">{n.body}</p>
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
