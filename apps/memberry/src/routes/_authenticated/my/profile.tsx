import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonOptions, updatePersonMutation, createPersonMutation } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { Person } from '@monobase/sdk-ts/generated/types.gen'
import { formatPersonName, formatLicenseDisplay } from '@/features/profile/lib/profile-display'
import { zodResolver } from '@/lib/zod-resolver'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/patterns/page-header'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { StatusBadge } from '@/components/patterns/status-badge'
import { ProfileSkeleton } from '@/components/patterns/skeleton-loader'
import { Button, Input, Label } from '@monobase/ui'
import { Shield, Lock, CreditCard, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/my/profile')({
  component: MyProfilePage,
})

interface MembershipItem {
  id: string
  organizationId?: string
  organizationName?: string
  status?: string
  memberNumber?: string
  duesExpiryDate?: string
}

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
      const res = await api.get<{ data: MembershipItem[] }>('/api/persons/me/memberships')
      return res?.data || []
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

  const p = person

  if (editing) {
    return <ProfileEditForm person={p} onCancel={() => { setEditing(false); setError(null) }} onSave={mutation} error={error} />
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your professional identity"
        actions={
          <Button onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
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
                photoUrl={p?.avatar?.url || (p as unknown as { photoUrl?: string })?.photoUrl}
            />
          </div>
          <h2 className="text-h3 mt-3 text-center md:text-left">
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
          <GlassCard className="p-5">
            <h3 className="text-h4 mb-3">Contact</h3>
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
          </GlassCard>

          {/* Org Memberships */}
          {memberships.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-h4 mb-3">Organizations</h3>
              <div className="space-y-2">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <span className="text-[14px]">{m.orgName}</span>
                    <StatusBadge status={m.status ?? 'pending'} />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-[14px] font-semibold">
              <Shield size={18} className="text-[var(--color-muted)]" /> Privacy
            </Link>
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-[14px] font-semibold">
              <Lock size={18} className="text-[var(--color-muted)]" /> Security
            </Link>
            <Link to="/my/id-card" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-[14px] font-semibold">
              <CreditCard size={18} className="text-[var(--color-muted)]" /> ID Card
            </Link>
            <Link to="/my/data-export" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-[14px] font-semibold">
              <Download size={18} className="text-[var(--color-muted)]" /> Data Export
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const profileEditSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  specialization: z.string().optional(),
  licenseNumber: z.string().optional(),
  prcId: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  preferredLanguage: z.string().optional(),
})

type ProfileEditFormData = z.infer<typeof profileEditSchema>

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileEditFormData>({
    mode: 'onBlur',
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      firstName: person?.firstName || '',
      lastName: person?.lastName || '',
      middleName: person?.middleName || '',
      specialization: person?.specialization || '',
      licenseNumber: person?.licenseNumber || '',
      prcId: person?.prcId || '',
      phone: person?.contactInfo?.phone || '',
      timezone: person?.timezone || '',
      preferredLanguage: person?.preferredLanguage || '',
    },
  })

  function onSubmit(data: ProfileEditFormData) {
    onSave.mutate({
      path: { person: person?.id || 'me' },
      body: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        middleName: data.middleName || null,
        specialization: data.specialization || null,
        licenseNumber: data.licenseNumber || null,
        prcId: data.prcId || null,
        contactInfo: {
          email: person?.contactInfo?.email,
          phone: data.phone || undefined,
        },
        timezone: data.timezone || null,
        preferredLanguage: data.preferredLanguage || null,
      },
    })
  }

  function field(
    label: string,
    name: keyof ProfileEditFormData,
    opts?: { placeholder?: string }
  ) {
    const errMsg = errors[name]?.message
    return (
      <div>
        <Label
          htmlFor={name}
          className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1.5"
        >
          {label}
        </Label>
        <Input
          id={name}
          type="text"
          placeholder={opts?.placeholder}
          className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-[14px] focus:outline-none focus:border-[var(--color-primary)] focus:ring-[4px] focus:ring-[var(--color-primary-subtle)]"
          aria-describedby={errMsg ? `${name}-error` : undefined}
          {...register(name)}
        />
        {errMsg && (
          <p id={`${name}-error`} role="alert" className="text-xs text-[var(--color-error)] mt-1">
            {errMsg}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Edit Profile"
        actions={
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        }
      />

      {error && (
        <div role="alert" aria-live="polite" className="rounded-[8px] border border-[var(--color-error)] bg-[var(--color-error-bg)] text-[var(--color-error)] p-3 text-[14px] mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-6 space-y-4">
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
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={onSave.isPending}
          >
            {onSave.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
