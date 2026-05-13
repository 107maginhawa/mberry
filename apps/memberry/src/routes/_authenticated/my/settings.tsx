import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/my/settings')({
  component: MySettingsPage,
})

const NOTIFICATION_CATEGORIES = [
  { key: 'dues', label: 'Dues & Payments', desc: 'Payment reminders, receipts, overdue notices' },
  { key: 'events', label: 'Events', desc: 'Event invitations, registration updates, reminders' },
  { key: 'trainings', label: 'Trainings', desc: 'Course enrollment, completion, deadlines' },
  { key: 'announcements', label: 'Announcements', desc: 'Organization-wide communications' },
  { key: 'credits', label: 'Credits', desc: 'CPD credit awards, cycle reminders' },
]

const PRIVACY_FIELDS = [
  { key: 'emailVisible', label: 'Email', desc: 'Show email in the member directory' },
  { key: 'phoneVisible', label: 'Phone', desc: 'Show phone number in the member directory' },
  { key: 'photoVisible', label: 'Photo', desc: 'Show profile photo in the member directory' },
  { key: 'addressVisible', label: 'Address', desc: 'Show address in the member directory' },
]

function MySettingsPage() {
  return (
    <div className="max-w-[600px]">
      <PageHeader title="Settings" subtitle="Manage your account preferences" />
      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralSection />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacySection />
        </TabsContent>
        <TabsContent value="security">
          <AccountSection />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationPreferencesSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GeneralSection() {
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const deletionQuery = useQuery<string | null>({
    queryKey: ['person-deletion-status'],
    queryFn: async () => {
      const data = await api.get<any>('/api/persons/me')
      const p = data.data ?? data
      return p?.deletionScheduledAt ?? null
    },
    retry: false,
  })

  const deletionPending = deletionQuery.data ?? null

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    try {
      await api.post<any>('/api/persons/me/delete')
      await queryClient.invalidateQueries({ queryKey: ['person-deletion-status'] })
      setShowConfirm(false)
      setConfirmText('')
    } catch {
      // error handled silently
    } finally {
      setDeleting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await api.post('/api/persons/me/cancel-delete')
      await queryClient.invalidateQueries({ queryKey: ['person-deletion-status'] })
    } catch {
      // error handled silently
    } finally {
      setCancelling(false)
    }
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">General</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">Basic account settings</p>
      </div>
      <Link
        to="/my/profile"
        className="flex items-center justify-between rounded-[8px] border border-[var(--color-border-light)] p-4 hover:shadow-soft transition-shadow"
      >
        <div>
          <p className="text-[14px] font-semibold">Edit Profile</p>
          <p className="text-[13px] text-[var(--color-muted)]">Update your name, specialization, and contact info</p>
        </div>
        <span className="text-[var(--color-muted)]">&rarr;</span>
      </Link>

      <div className="border-t border-[var(--color-border-light)] pt-4 mt-4">
        <h3 className="text-[14px] font-semibold text-[var(--color-error)]">Danger Zone</h3>

        {deletionPending ? (
          <div className="mt-3 rounded-[8px] border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-4">
            <p className="text-[14px] font-semibold text-[var(--color-warning)]">Account deletion scheduled</p>
            <p className="text-[13px] text-[var(--color-muted)] mt-1">
              Your account will be permanently anonymized on{' '}
              <strong>{new Date(deletionPending).toLocaleDateString()}</strong>.
              You can cancel before then.
            </p>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-3 px-4 py-[7px] rounded-[8px] border border-[var(--color-border)] bg-white text-[13px] font-semibold hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Deletion'}
            </button>
          </div>
        ) : showConfirm ? (
          <div className="mt-3 rounded-[8px] border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] p-4 space-y-3">
            <p className="text-[13px] text-[var(--color-muted)]">
              This will schedule your account for deletion after a 30-day grace period.
              Your personal data will be anonymized. Financial records are retained per law.
            </p>
            <p className="text-[13px] font-semibold">Type DELETE to confirm:</p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-[6px] px-3 py-2 text-[13px]"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || deleting}
                className="px-4 py-[7px] rounded-[8px] bg-[var(--color-error)] text-white text-[13px] font-semibold hover:opacity-90 transition-colors duration-150 disabled:opacity-50"
              >
                {deleting ? 'Requesting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText('') }}
                className="px-4 py-[7px] rounded-[8px] border border-[var(--color-border)] text-[13px] font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-[var(--color-muted)] mt-1">
              Account deletion is permanent. Your data will be anonymized after a 30-day grace period.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              className="mt-3 px-4 py-[7px] rounded-[8px] bg-[var(--color-error)] text-white text-[13px] font-semibold hover:opacity-90 transition-colors duration-150"
            >
              Delete Account
            </button>
          </>
        )}
      </div>
    </GlassCard>
  )
}

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<any[] | null>(null)

  const prefsQuery = useQuery<any[]>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const data = await api.get<any>('/api/persons/me/notification-preferences')
      return Array.isArray(data) ? data : []
    },
    retry: false,
  })

  // Use local state for optimistic updates, fall back to query data
  const effectivePrefs = prefs ?? prefsQuery.data ?? []

  const toggle = useCallback(async (category: string, field: 'pushEnabled' | 'emailEnabled', value: boolean) => {
    const current = prefs ?? prefsQuery.data ?? []
    setPrefs(current.map(p =>
      p.category === category ? { ...p, [field]: value } : p
    ))

    try {
      await api.patch('/api/persons/me/notification-preferences', { category, [field]: value })
    } catch {
      setPrefs(current.map(p =>
        p.category === category ? { ...p, [field]: !value } : p
      ))
    }
  }, [prefs, prefsQuery.data])

  if (prefsQuery.isLoading) return <div className="text-[14px] text-[var(--color-muted)]">Loading preferences...</div>

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">Notification Preferences</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">In-app notifications are always on. High-priority items always push.</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_CATEGORIES.map(cat => {
          const pref = effectivePrefs.find(p => p.category === cat.key) || { pushEnabled: true, emailEnabled: false }
          return (
            <div key={cat.key} className="flex items-center justify-between py-2 border-b border-[var(--color-border-light)] last:border-0">
              <div>
                <div className="text-[14px] font-semibold">{cat.label}</div>
                <div className="text-[13px] text-[var(--color-muted)]">{cat.desc}</div>
              </div>
              <div className="flex gap-4">
                <ToggleSwitch
                  label="Push"
                  checked={pref.pushEnabled}
                  onChange={(v) => toggle(cat.key, 'pushEnabled', v)}
                />
                <ToggleSwitch
                  label="Email"
                  checked={pref.emailEnabled}
                  onChange={(v) => toggle(cat.key, 'emailEnabled', v)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

function PrivacySection() {
  const [allSettings, setAllSettings] = useState<any[] | null>(null)
  const [selectedOrgIndex, setSelectedOrgIndex] = useState(0)

  const defaults = {
    emailVisible: false,
    phoneVisible: false,
    photoVisible: true,
    addressVisible: false,
  }

  const privacyQuery = useQuery<any[]>({
    queryKey: ['privacy-settings'],
    queryFn: async () => {
      const data = await api.get<any>('/api/persons/me/privacy')
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
      return []
    },
    retry: false,
  })

  // Use local state for optimistic updates, fall back to query data
  const effectiveSettings = allSettings ?? privacyQuery.data ?? []

  const privacy = effectiveSettings[selectedOrgIndex] ?? defaults
  const orgId = privacy.orgId

  const toggle = useCallback(async (field: string, value: boolean) => {
    if (!orgId) return // no org context — cannot save

    const current = allSettings ?? privacyQuery.data ?? []
    setAllSettings(current.map((s, i) =>
      i === selectedOrgIndex ? { ...s, [field]: value } : s
    ))

    try {
      await api.patch('/api/persons/me/privacy', { orgId, [field]: value })
    } catch {
      setAllSettings(current.map((s, i) =>
        i === selectedOrgIndex ? { ...s, [field]: !value } : s
      ))
    }
  }, [orgId, selectedOrgIndex, allSettings, privacyQuery.data])

  if (privacyQuery.isLoading) return null

  if (effectiveSettings.length === 0) {
    return (
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-[16px] font-semibold font-display">Privacy</h2>
        <p className="text-[14px] text-[var(--color-muted)]">
          Join an organization to configure privacy settings.
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">Privacy</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">
          Control your profile visibility in the member directory.
          Officers always see your name and license number.
        </p>
      </div>

      {effectiveSettings.length > 1 && (
        <select
          value={selectedOrgIndex}
          onChange={(e) => setSelectedOrgIndex(Number(e.target.value))}
          className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-[14px]"
        >
          {effectiveSettings.map((s, i) => (
            <option key={s.orgId} value={i}>
              {s.orgName || s.orgId}
            </option>
          ))}
        </select>
      )}

      <div className="space-y-3">
        {PRIVACY_FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between py-2 border-b border-[var(--color-border-light)] last:border-0">
            <div>
              <div className="text-[14px] font-semibold">{f.label}</div>
              <div className="text-[13px] text-[var(--color-muted)]">{f.desc}</div>
            </div>
            <ToggleSwitch
              label="Visible"
              checked={privacy[f.key] ?? false}
              onChange={(v) => toggle(f.key, v)}
            />
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function AccountSection() {
  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">Security</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">
          Manage your password, email, and security settings.
        </p>
      </div>
      <a
        href="/auth/settings"
        className="inline-flex items-center rounded-[8px] border-[1.5px] border-[var(--color-border)] px-[22px] py-[10px] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150"
      >
        Open Account Settings
      </a>
    </GlassCard>
  )
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-[13px] text-[var(--color-muted)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
