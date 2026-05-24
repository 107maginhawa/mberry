/**
 * NotificationPreferences — toggle matrix for notification channel preferences.
 * 5 categories x 3 channels (Email, Push, In-App).
 * VS-031: Wave 4b Communications.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Switch } from '@monobase/ui'
import { toast } from 'sonner'
import { GlassCard } from '@/components/motion/glass-card'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreferencesProps {
  orgId: string
  personId: string
}

interface CategoryDef {
  key: string
  label: string
  types: string[]
}

type Channel = 'email' | 'push' | 'inapp'

// Map of categoryKey-channel => enabled
type PreferenceState = Record<string, boolean>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: CategoryDef[] = [
  { key: 'dues', label: 'Dues', types: ['billing.*', 'dunning.*'] },
  { key: 'events', label: 'Events', types: ['event.*', 'booking.*'] },
  { key: 'training', label: 'Training', types: ['training.*'] },
  { key: 'announcements', label: 'Announcements', types: ['system'] },
  { key: 'comms', label: 'Comms', types: ['comms.*', 'waitlist.*', 'task.*'] },
]

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Push' },
  { key: 'inapp', label: 'In-App' },
]

function prefKey(category: string, channel: Channel): string {
  return `${category}-${channel}`
}

function buildDefaultState(): PreferenceState {
  const state: PreferenceState = {}
  for (const cat of CATEGORIES) {
    for (const ch of CHANNELS) {
      state[prefKey(cat.key, ch.key)] = true // default all on
    }
  }
  return state
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPreferences({ orgId, personId }: PreferencesProps) {
  const [prefs, setPrefs] = useState<PreferenceState>(buildDefaultState)

  // Load existing preferences
  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences', personId],
    queryFn: () =>
      api.get<{ data: any[] }>(
        `/api/communications/subscriptions/person?personId=${personId}`
      ),
    enabled: !!personId,
  })

  // Merge server data into local state
  useEffect(() => {
    if (!data?.data) return
    const serverPrefs = data.data
    setPrefs((prev) => {
      const next = { ...prev }
      for (const sub of serverPrefs) {
        const topicId = sub.topicId as string
        // Match topicId pattern like "dues-email"
        if (topicId && topicId in next) {
          next[topicId] = sub.enabled !== false
        }
      }
      return next
    })
  }, [data])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (updates: { topicId: string; enabled: boolean }[]) =>
      api.post('/api/communications/subscriptions/bulk', {
        personId,
        updates,
      }),
    onError: () => toast.error('Failed to save preference'),
  })

  const handleToggle = useCallback(
    (category: string, channel: Channel) => {
      const key = prefKey(category, channel)
      const newValue = !prefs[key]

      setPrefs((prev) => ({ ...prev, [key]: newValue }))

      saveMutation.mutate([{ topicId: key, enabled: newValue }])
    },
    [prefs, saveMutation]
  )

  // Loading skeleton
  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-4 w-24 rounded bg-[var(--color-border-light)]" />
              <div className="flex gap-6 ml-auto">
                <div className="h-5 w-9 rounded-full bg-[var(--color-border-light)]" />
                <div className="h-5 w-9 rounded-full bg-[var(--color-border-light)]" />
                <div className="h-5 w-9 rounded-full bg-[var(--color-border-light)]" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center mb-4 pb-3 border-b border-[var(--color-border-light)]">
        <div className="text-[12px] font-medium text-[var(--color-muted)] uppercase tracking-wide">
          Category
        </div>
        {CHANNELS.map((ch) => (
          <div
            key={ch.key}
            className="text-[12px] font-medium text-[var(--color-muted)] uppercase tracking-wide text-center"
          >
            {ch.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center py-2"
          >
            <div>
              <p className="text-[14px] font-medium text-[var(--color-text)]">{cat.label}</p>
              <p className="text-[12px] text-[var(--color-muted)]">
                {cat.types.join(', ')}
              </p>
            </div>
            {CHANNELS.map((ch) => {
              const key = prefKey(cat.key, ch.key)
              return (
                <div key={ch.key} className="flex justify-center">
                  <Switch
                    checked={prefs[key] ?? true}
                    onCheckedChange={() => handleToggle(cat.key, ch.key)}
                    aria-label={`${cat.label} ${ch.label}`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
