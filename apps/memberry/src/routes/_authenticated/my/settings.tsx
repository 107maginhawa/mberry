import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { ChangePasswordCard, TwoFactorCard, PasskeysCard, SessionsCard } from '@daveyplate/better-auth-ui'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { api } from '@/lib/api'
import { toast } from 'sonner'

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
  { key: 'credentialsVisible', label: 'Credentials', desc: 'Show verified credentials in the directory' },
  { key: 'duesStatusVisible', label: 'Dues Status', desc: 'Show dues standing in the directory' },
  { key: 'ceComplianceVisible', label: 'CE Compliance', desc: 'Show continuing education status in the directory' },
]

function MySettingsPage() {
  return (
    <PageShell title="Settings" subtitle="Manage your account preferences">
      <div className="max-w-[600px]">
      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="animate-in fade-in-0 duration-300">
          <GeneralSection />
        </TabsContent>
        <TabsContent value="privacy" className="animate-in fade-in-0 duration-300">
          <PrivacySection />
        </TabsContent>
        <TabsContent value="security" className="animate-in fade-in-0 duration-300">
          <AccountSection />
        </TabsContent>
        <TabsContent value="notifications" className="animate-in fade-in-0 duration-300">
          <NotificationPreferencesSection />
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
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
      toast.success('Account deletion scheduled')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to schedule account deletion')
    } finally {
      setDeleting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await api.post('/api/persons/me/cancel-delete')
      await queryClient.invalidateQueries({ queryKey: ['person-deletion-status'] })
      toast.success('Account deletion cancelled')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to cancel account deletion')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-h4">General</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">Basic account settings</p>
      </div>
      <Link
        to="/my/profile"
        className="flex items-center justify-between rounded-sm border border-[var(--color-border-light)] p-4 hover:shadow-soft transition-shadow"
      >
        <div>
          <p className="text-sm font-semibold">Edit Profile</p>
          <p className="text-sm text-[var(--color-muted)]">Update your name, specialization, and contact info</p>
        </div>
        <span className="text-[var(--color-muted)]">&rarr;</span>
      </Link>

      <div className="border-t border-[var(--color-border-light)] pt-4 mt-4">
        <h3 className="text-h4 text-[var(--color-error)]">Danger Zone</h3>

        {deletionPending ? (
          <div className="mt-3 rounded-sm border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-4">
            <p className="text-sm font-semibold text-[var(--color-warning)]">Account deletion scheduled</p>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Your account will be permanently anonymized on{' '}
              <strong>{new Date(deletionPending).toLocaleDateString()}</strong>.
              You can cancel before then.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-3"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Deletion'}
            </Button>
          </div>
        ) : showConfirm ? (
          <div className="mt-3 rounded-sm border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] p-4 space-y-3">
            <p className="text-sm text-[var(--color-muted)]">
              This will schedule your account for deletion after a 30-day grace period.
              Your personal data will be anonymized. Financial records are retained per law.
            </p>
            <p className="text-sm font-semibold">Type DELETE to confirm:</p>
            <Input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-[6px] px-3 py-2 text-sm"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || deleting}
              >
                {deleting ? 'Requesting...' : 'Confirm Delete'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowConfirm(false); setConfirmText('') }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Account deletion is permanent. Your data will be anonymized after a 30-day grace period.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
              className="mt-3"
            >
              Delete Account
            </Button>
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

  if (prefsQuery.isLoading) return <GlassCard className="p-6"><ListSkeleton rows={5} /></GlassCard>
  if (prefsQuery.isError) return (
    <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
      Unable to load notification preferences. Please try refreshing the page.
    </div>
  )

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-h4">Notification Preferences</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">In-app notifications are always on. High-priority items always push.</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_CATEGORIES.map(cat => {
          const pref = effectivePrefs.find(p => p.category === cat.key) || { pushEnabled: true, emailEnabled: false }
          return (
            <div key={cat.key} className="flex items-center justify-between py-2 border-b border-[var(--color-border-light)] last:border-0">
              <div>
                <div className="text-sm font-semibold">{cat.label}</div>
                <div className="text-sm text-[var(--color-muted)]">{cat.desc}</div>
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
    credentialsVisible: false,
    duesStatusVisible: false,
    ceComplianceVisible: false,
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

  if (privacyQuery.isLoading) return <GlassCard className="p-6"><ListSkeleton rows={4} /></GlassCard>
  if (privacyQuery.isError) return (
    <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
      Unable to load privacy settings. Please try refreshing the page.
    </div>
  )

  if (effectiveSettings.length === 0) {
    return (
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-h4">Privacy</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Join an organization to configure privacy settings.
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h2 className="text-h4">Privacy</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Control your profile visibility in the member directory.
          Officers always see your name and license number.
        </p>
      </div>

      {effectiveSettings.length > 1 && (
        <Select value={String(selectedOrgIndex)} onValueChange={(v) => setSelectedOrgIndex(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {effectiveSettings.map((s, i) => (
              <SelectItem key={s.orgId} value={String(i)}>
                {s.orgName || s.orgId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="space-y-3">
        {PRIVACY_FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between py-2 border-b border-[var(--color-border-light)] last:border-0">
            <div>
              <div className="text-sm font-semibold">{f.label}</div>
              <div className="text-sm text-[var(--color-muted)]">{f.desc}</div>
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
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h4">Security</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>
      <ChangePasswordCard />
      <TwoFactorCard />
      <PasskeysCard />
      <SessionsCard />
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
    <div className="flex items-center gap-2 cursor-pointer select-none">
      <Label className="text-sm text-[var(--color-muted)] cursor-pointer">{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}
