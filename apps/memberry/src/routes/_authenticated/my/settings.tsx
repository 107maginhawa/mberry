import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/patterns/page-header'

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
  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
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
        <p className="text-[13px] text-[var(--color-muted)] mt-1">
          Account deletion is permanent. Your data will be anonymized after a 30-day grace period.
        </p>
        <button className="mt-3 px-4 py-[7px] rounded-[8px] bg-[var(--color-error)] text-white text-[13px] font-semibold hover:opacity-90 transition-colors duration-150">
          Delete Account
        </button>
      </div>
    </div>
  )
}

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/persons/me/notification-preferences')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => { setPrefs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = useCallback(async (category: string, field: 'pushEnabled' | 'emailEnabled', value: boolean) => {
    setPrefs(prev => prev.map(p =>
      p.category === category ? { ...p, [field]: value } : p
    ))

    try {
      const res = await fetch('/api/persons/me/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, [field]: value }),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      setPrefs(prev => prev.map(p =>
        p.category === category ? { ...p, [field]: !value } : p
      ))
    }
  }, [])

  if (loading) return <div className="text-[14px] text-[var(--color-muted)]">Loading preferences...</div>

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">Notification Preferences</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">In-app notifications are always on. High-priority items always push.</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_CATEGORIES.map(cat => {
          const pref = prefs.find(p => p.category === cat.key) || { pushEnabled: true, emailEnabled: false }
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
    </div>
  )
}

function PrivacySection() {
  const [allSettings, setAllSettings] = useState<any[]>([])
  const [selectedOrgIndex, setSelectedOrgIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const defaults = {
    emailVisible: false,
    phoneVisible: false,
    photoVisible: true,
    addressVisible: false,
  }

  useEffect(() => {
    fetch('/api/persons/me/privacy')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllSettings(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const privacy = allSettings[selectedOrgIndex] ?? defaults
  const orgId = privacy.orgId

  const toggle = useCallback(async (field: string, value: boolean) => {
    if (!orgId) return // no org context — cannot save

    setAllSettings(prev => prev.map((s, i) =>
      i === selectedOrgIndex ? { ...s, [field]: value } : s
    ))

    try {
      const res = await fetch('/api/persons/me/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, [field]: value }),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      setAllSettings(prev => prev.map((s, i) =>
        i === selectedOrgIndex ? { ...s, [field]: !value } : s
      ))
    }
  }, [orgId, selectedOrgIndex])

  if (loading) return null

  if (allSettings.length === 0) {
    return (
      <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
        <h2 className="text-[16px] font-semibold font-display">Privacy</h2>
        <p className="text-[14px] text-[var(--color-muted)]">
          Join an organization to configure privacy settings.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold font-display">Privacy</h2>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">
          Control your profile visibility in the member directory.
          Officers always see your name and license number.
        </p>
      </div>

      {allSettings.length > 1 && (
        <select
          value={selectedOrgIndex}
          onChange={(e) => setSelectedOrgIndex(Number(e.target.value))}
          className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-[14px]"
        >
          {allSettings.map((s, i) => (
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
    </div>
  )
}

function AccountSection() {
  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
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
    </div>
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
