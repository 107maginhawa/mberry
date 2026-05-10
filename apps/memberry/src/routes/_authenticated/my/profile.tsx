import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonOptions, updatePersonMutation, createPersonMutation } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { formatPersonName, formatLicenseDisplay } from '@/features/profile/lib/profile-display'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { StatusBadge } from '@/components/patterns/status-badge'
import { ProfileSkeleton } from '@/components/patterns/skeleton-loader'
import { Shield, Lock, CreditCard, Download } from 'lucide-react'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/my/profile')({
  component: MyProfilePage,
})

function MyProfilePage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: person, isLoading, isError } = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  // Auto-create person record if missing (for users who signed up before the hook)
  const { user } = Route.useRouteContext()
  const createPerson = useMutation({
    ...createPersonMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPersonOptions({ path: { person: 'me' } }).queryKey })
    },
  })

  useEffect(() => {
    if (isError && user && !createPerson.isPending && !createPerson.isSuccess) {
      const nameParts = (user.name || '').trim().split(/\s+/)
      createPerson.mutate({
        body: {
          firstName: nameParts[0] || user.email?.split('@')[0] || 'Member',
          lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined,
          contactInfo: { email: user.email },
        },
      })
    }
  }, [isError, user])

  const { data: memberships = [] } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const res = await api.get<any>('/api/persons/me/memberships')
      return (res?.data || []) as any[]
    },
  })

  const mutation = useMutation({
    ...updatePersonMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPersonOptions({ path: { person: 'me' } }).queryKey })
      setEditing(false)
      setError(null)
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save changes')
    },
  })

  if (isLoading) return <ProfileSkeleton />

  if (isError || !person) {
    return (
      <div>
        <PageHeader title="Profile" />
        <div className="rounded-[12px] border border-[var(--color-border-light)] p-6 text-center text-[var(--color-muted)]">
          No profile found. Complete onboarding to create your profile.
        </div>
      </div>
    )
  }

  const p = person as any

  if (editing) {
    return <ProfileEditForm person={p} onCancel={() => { setEditing(false); setError(null) }} onSave={mutation} error={error} />
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your professional identity"
        actions={
          <button
            onClick={() => setEditing(true)}
            className="px-[22px] py-[10px] rounded-[8px] bg-[var(--color-primary)] text-white text-[14px] font-semibold hover:bg-[var(--color-primary-mid)] transition-colors duration-150"
          >
            Edit Profile
          </button>
        }
      />

      {/* Two-column layout: photo + info */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Avatar + quick info */}
        <div className="md:w-1/3 flex flex-col items-center md:items-start">
          <div data-testid="profile-avatar">
            <AvatarInitials
              name={formatPersonName(p?.firstName || '?', p?.lastName, p?.middleName)}
              size="lg"
              photoUrl={(p as any)?.avatar?.url || p?.photoUrl}
            />
          </div>
          <h2 className="text-[20px] font-bold font-display mt-3 text-center md:text-left">
            {formatPersonName(p?.firstName || '', p?.lastName, p?.middleName)}
          </h2>
          {p?.specialization && (
            <span className="inline-block mt-1 px-3 py-1 rounded-full text-[12px] font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
              {p.specialization}
            </span>
          )}
          {formatLicenseDisplay(p?.licenseNumber, p?.prcId) && (
            <p className="text-[13px] font-medium text-[var(--color-muted)] mt-1">
              {formatLicenseDisplay(p.licenseNumber, p.prcId)}
            </p>
          )}
        </div>

        {/* Right: Detail sections */}
        <div className="md:w-2/3 space-y-4">
          {/* Contact */}
          <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
            <h3 className="text-[16px] font-semibold font-display mb-3">Contact</h3>
            <div className="space-y-2 text-[14px]">
              {p?.contactInfo?.email && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Email</span>
                  <span>{p.contactInfo.email}</span>
                </div>
              )}
              {p?.contactInfo?.phone && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Phone</span>
                  <span>{p.contactInfo.phone}</span>
                </div>
              )}
              {p?.timezone && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Timezone</span>
                  <span>{p.timezone}</span>
                </div>
              )}
              {p?.preferredLanguage && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Language</span>
                  <span>{p.preferredLanguage}</span>
                </div>
              )}
            </div>
          </section>

          {/* Org Memberships */}
          {memberships.length > 0 && (
            <section className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
              <h3 className="text-[16px] font-semibold font-display mb-3">Organizations</h3>
              <div className="space-y-2">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <span className="text-[14px]">{m.orgName}</span>
                    <StatusBadge status={m.status ?? 'pending'} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 hover:shadow-soft transition-shadow text-[14px] font-semibold">
              <Shield size={18} className="text-[var(--color-muted)]" /> Privacy
            </Link>
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 hover:shadow-soft transition-shadow text-[14px] font-semibold">
              <Lock size={18} className="text-[var(--color-muted)]" /> Security
            </Link>
            <Link to="/my/id-card" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 hover:shadow-soft transition-shadow text-[14px] font-semibold">
              <CreditCard size={18} className="text-[var(--color-muted)]" /> ID Card
            </Link>
            <Link to="/my/data-export" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 hover:shadow-soft transition-shadow text-[14px] font-semibold">
              <Download size={18} className="text-[var(--color-muted)]" /> Data Export
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileEditForm({
  person,
  onCancel,
  onSave,
  error,
}: {
  person: any
  onCancel: () => void
  onSave: any
  error: string | null
}) {
  const [form, setForm] = useState({
    firstName: person?.firstName || '',
    lastName: person?.lastName || '',
    middleName: person?.middleName || '',
    specialization: person?.specialization || '',
    licenseNumber: person?.licenseNumber || '',
    prcId: person?.prcId || '',
    phone: person?.contactInfo?.phone || '',
    timezone: person?.timezone || '',
    preferredLanguage: person?.preferredLanguage || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave.mutate({
      path: { person: person?.id || 'me' },
      body: {
        firstName: form.firstName,
        lastName: form.lastName || null,
        middleName: form.middleName || null,
        specialization: form.specialization || null,
        licenseNumber: form.licenseNumber || null,
        prcId: form.prcId || null,
        contactInfo: {
          email: person?.contactInfo?.email,
          phone: form.phone || undefined,
        },
        timezone: form.timezone || null,
        preferredLanguage: form.preferredLanguage || null,
      },
    })
  }

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string }) => (
    <div>
      <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1.5">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
        className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-[14px] focus:outline-none focus:border-[var(--color-primary)] focus:ring-[4px] focus:ring-[var(--color-primary-subtle)]"
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Edit Profile"
        actions={
          <button
            onClick={onCancel}
            className="px-[22px] py-[10px] rounded-[8px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150"
          >
            Cancel
          </button>
        }
      />

      {error && (
        <div className="rounded-[8px] border border-[var(--color-error)] bg-[var(--color-error-bg)] text-[var(--color-error)] p-3 text-[14px] mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('First Name', 'firstName')}
          {field('Last Name', 'lastName')}
        </div>
        {field('Middle Name', 'middleName')}

        <div className="border-t border-[var(--color-border-light)] my-4" />

        {field('Specialization', 'specialization', { placeholder: 'e.g. Orthodontics' })}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('License Number', 'licenseNumber')}
          {field('PRC ID', 'prcId')}
        </div>

        <div className="border-t border-[var(--color-border-light)] my-4" />

        {field('Phone', 'phone', { placeholder: '+63 ...' })}
        {field('Timezone', 'timezone', { placeholder: 'Asia/Manila' })}
        {field('Preferred Language', 'preferredLanguage', { placeholder: 'en' })}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-[22px] py-[10px] rounded-[8px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={onSave.isPending || !form.firstName}
            className="px-[22px] py-[10px] rounded-[8px] bg-[var(--color-primary)] text-white text-[14px] font-semibold hover:bg-[var(--color-primary-mid)] disabled:opacity-50 transition-colors duration-150"
          >
            {onSave.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
