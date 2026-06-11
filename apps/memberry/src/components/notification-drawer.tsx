/**
 * NotificationDrawer — slide-out sheet from the right with category tabs.
 * VS-029: Wave 4a Communications.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@monobase/ui'
import {
  Bell,
  CreditCard,
  Calendar,
  GraduationCap,
  CheckCheck,
  MessageSquare,
  Settings2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useOrgContext } from '@/hooks/use-org-context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DrawerCategory = 'all' | 'dues' | 'events' | 'training' | 'comms'

interface NotifItem {
  id: string
  title: string
  message: string
  type: string
  status: string
  createdAt: Date
  relatedEntityType?: string
  relatedEntityId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES: { key: DrawerCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dues', label: 'Dues' },
  { key: 'events', label: 'Events' },
  { key: 'training', label: 'Training' },
  { key: 'comms', label: 'Comms' },
]

function typeToCategory(type: string): DrawerCategory {
  if (type === 'billing' || type.startsWith('billing.') || type.startsWith('dunning.')) return 'dues'
  if (type.startsWith('event.') || type.startsWith('booking.')) return 'events'
  if (type === 'training' || type.startsWith('training.')) return 'training'
  return 'comms'
}

function categoryIcon(cat: DrawerCategory) {
  switch (cat) {
    case 'dues': return <CreditCard size={14} />
    case 'events': return <Calendar size={14} />
    case 'training': return <GraduationCap size={14} />
    case 'comms': return <MessageSquare size={14} />
    default: return <Bell size={14} />
  }
}

function typeIcon(type: string) {
  return categoryIcon(typeToCategory(type))
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function mapRaw(raw: any): NotifItem {
  return {
    id: raw.id,
    title: raw.title || 'Notification',
    message: raw.message || raw.body || '',
    type: raw.type || 'system',
    status: raw.status || 'sent',
    createdAt: new Date(raw.createdAt || raw.sentAt || Date.now()),
    relatedEntityType: raw.relatedEntityType,
    relatedEntityId: raw.relatedEntityId,
  }
}

function entityRoute(
  entityType: string | undefined,
  entityId: string | undefined,
  orgId: string | null,
): string | null {
  if (!orgId || !entityType) return null
  switch (entityType) {
    case 'invoice':
    case 'payment':
      return `/org/${orgId}/dues`
    case 'event':
      return `/org/${orgId}/events`
    case 'training':
      return `/org/${orgId}/training`
    case 'booking':
      return `/org/${orgId}/bookings`
    case 'announcement':
      return entityId ? `/org/${orgId}/announcements/${entityId}` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const [activeCategory, setActiveCategory] = useState<DrawerCategory>('all')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { orgId } = useOrgContext()

  // Fetch notifications (only when drawer is open)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const json = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      return ((json.data || json.items || []) as any[]).map(mapRaw)
    },
    enabled: open,
  })

  // Filter by active category
  const filtered = useMemo(() => {
    if (activeCategory === 'all') return notifications
    return notifications.filter((n) => typeToCategory(n.type) === activeCategory)
  }, [notifications, activeCategory])

  const unreadCount = notifications.filter((n) => n.status !== 'read').length

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifs/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/api/notifs/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  function handleNotifClick(n: NotifItem) {
    if (n.status !== 'read') {
      markReadMutation.mutate(n.id)
    }
    const route = entityRoute(n.relatedEntityType, n.relatedEntityId, orgId)
    if (route) {
      onOpenChange(false)
      navigate({ to: route as '/' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] max-w-full flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="gap-1.5 text-xs text-[var(--color-primary)]"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </Button>
              )}
              {orgId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onOpenChange(false)
                    navigate({ to: `/org/${orgId}/my-notifications` as '/' })
                  }}
                  className="gap-1 text-xs text-[var(--color-muted)]"
                  title="Notification preferences"
                >
                  <Settings2 size={14} />
                </Button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              // eslint-disable-next-line no-restricted-syntax -- chip-style toggle; shadcn Button shape collides with pill layout
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-warm)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {categoryIcon(cat.key)}
                {cat.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-border-light)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded bg-[var(--color-border-light)] w-3/4" />
                    <div className="h-2.5 rounded bg-[var(--color-border-light)] w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface-warm)] flex items-center justify-center mb-3">
                <Bell size={24} className="text-[var(--color-muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text)]">No notifications</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {activeCategory === 'all'
                  ? "You're all caught up"
                  : 'Nothing in this category'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-light)]">
              {filtered.map((n) => {
                const isUnread = n.status !== 'read'
                return (
                  // eslint-disable-next-line no-restricted-syntax -- full-row click target; shadcn Button collides with list-item layout
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-warm)] ${
                      isUnread ? 'bg-[var(--color-cream-light)]' : ''
                    }`}
                  >
                    {/* Icon */}
                    <span
                      className={`mt-0.5 shrink-0 p-1.5 rounded-full ${
                        isUnread
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-border-light)] text-[var(--color-muted)]'
                      }`}
                    >
                      {typeIcon(n.type)}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            isUnread ? 'font-semibold text-[var(--color-text)]' : 'font-medium text-[var(--color-muted)]'
                          }`}
                        >
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[0.625rem] text-[var(--color-muted)] mt-0.5 whitespace-nowrap">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {isUnread && (
                      <span className="mt-2 shrink-0 w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
