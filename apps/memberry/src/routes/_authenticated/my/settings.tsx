import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'

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
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <NotificationPreferencesSection />
      <PrivacySection />
      <AccountSection />
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading preferences...</div>

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-medium text-lg">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground">In-app notifications are always on. High-priority items always push.</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_CATEGORIES.map(cat => {
          const pref = prefs.find(p => p.category === cat.key) || { pushEnabled: true, emailEnabled: false }
          return (
            <div key={cat.key} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <div className="text-sm font-medium">{cat.label}</div>
                <div className="text-xs text-muted-foreground">{cat.desc}</div>
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
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="font-medium text-lg">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Join an organization to configure privacy settings.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-medium text-lg">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Control your profile visibility in the member directory.
          Officers always see your name and license number.
        </p>
      </div>

      {allSettings.length > 1 && (
        <select
          value={selectedOrgIndex}
          onChange={(e) => setSelectedOrgIndex(Number(e.target.value))}
          className="w-full border rounded-md px-3 py-2 text-sm"
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
          <div key={f.key} className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
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
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-medium text-lg">Account</h2>
        <p className="text-sm text-muted-foreground">
          Manage your password, email, and security settings in the account portal.
        </p>
      </div>
      <a
        href="/auth/settings"
        className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-[#554B68]' : 'bg-gray-200'
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
