import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonOptions, updatePersonMutation, createPersonMutation } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { formatPersonName, formatLicenseDisplay } from '@/features/profile/lib/profile-display'
import { zodResolver } from '@/lib/zod-resolver'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/patterns/page-header'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { StatusBadge } from '@/components/patterns/status-badge'
import { ProfileSkeleton } from '@/components/patterns/skeleton-loader'
import { EmptyState } from '@/components/patterns/empty-state'
import { Button, Input, Label, Textarea } from '@monobase/ui'
import { Shield, Lock, CreditCard, Download, UserCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'
import { TrustBadges, type TrustSignals } from '@/features/profile/components/trust-badges'

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
        <EmptyState
          icon={<UserCircle size={40} />}
          headline="No profile found"
          description="Complete onboarding to create your professional profile."
        />
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

      <div className="flex flex-col md:flex-row gap-6">
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
            <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
              {p.specialization}
            </span>
          )}
          {formatLicenseDisplay(p?.licenseNumber, p?.prcId) && (
            <p className="text-sm font-medium text-[var(--color-muted)] mt-1">
              {formatLicenseDisplay(p.licenseNumber, p.prcId)}
            </p>
          )}
          <TrustBadges
            signals={{
              duesStatus: memberships.some((m: MembershipItem) => m.status === 'active') ? 'current' : null,
              credentialCount: 0,
              ceCreditsEarned: 0,
              hasVerifiedLicense: !!p?.licenseNumber,
            }}
          />
        </div>

        <div className="md:w-2/3 space-y-4">
          {/* Bio */}
          {p?.bio && (
            <GlassCard className="p-5">
              <h3 className="text-h4 mb-2">About</h3>
              <p className="text-sm text-[var(--color-muted)] whitespace-pre-line">{p.bio}</p>
            </GlassCard>
          )}

          {/* Contact */}
          <GlassCard className="p-5">
            <h3 className="text-h4 mb-3">Contact</h3>
            <div className="space-y-2 text-sm">
              {p?.contactInfo?.email && (
                <div className="flex justify-between"><span className="text-[var(--color-muted)]">Email</span><span>{p.contactInfo.email}</span></div>
              )}
              {p?.contactInfo?.phone && (
                <div className="flex justify-between"><span className="text-[var(--color-muted)]">Phone</span><span>{p.contactInfo.phone}</span></div>
              )}
              {p?.timezone && (
                <div className="flex justify-between"><span className="text-[var(--color-muted)]">Timezone</span><span>{p.timezone}</span></div>
              )}
              {p?.preferredLanguage && (
                <div className="flex justify-between"><span className="text-[var(--color-muted)]">Language</span><span>{p.preferredLanguage}</span></div>
              )}
            </div>
          </GlassCard>

          {/* Address */}
          {p?.primaryAddress && (
            <GlassCard className="p-5">
              <h3 className="text-h4 mb-3">Address</h3>
              <p className="text-sm text-[var(--color-muted)]">
                {[p.primaryAddress.street1, p.primaryAddress.street2, p.primaryAddress.city, p.primaryAddress.state, p.primaryAddress.postalCode, p.primaryAddress.country].filter(Boolean).join(', ')}
              </p>
            </GlassCard>
          )}

          {/* Memberships */}
          {memberships.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-h4 mb-3">Organizations</h3>
              <div className="space-y-2">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{m.orgName}</span>
                    <StatusBadge status={m.status ?? 'pending'} />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">
              <Shield size={18} className="text-[var(--color-muted)]" /> Privacy
            </Link>
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">
              <Lock size={18} className="text-[var(--color-muted)]" /> Security
            </Link>
            <Link to="/my/id-card" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">
              <CreditCard size={18} className="text-[var(--color-muted)]" /> ID Card
            </Link>
            <Link to="/my/data-export" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">
              <Download size={18} className="text-[var(--color-muted)]" /> Data Export
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Enhanced Edit Form ──────────────────────────────────

const profileEditSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  specialization: z.string().optional(),
  licenseNumber: z.string().optional(),
  prcId: z.string().optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  preferredLanguage: z.string().optional(),
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
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
      bio: person?.bio || '',
      phone: person?.contactInfo?.phone || '',
      timezone: person?.timezone || '',
      preferredLanguage: person?.preferredLanguage || '',
      street1: person?.primaryAddress?.street1 || '',
      street2: person?.primaryAddress?.street2 || '',
      city: person?.primaryAddress?.city || '',
      state: person?.primaryAddress?.state || '',
      postalCode: person?.primaryAddress?.postalCode || '',
      country: person?.primaryAddress?.country || '',
    },
  })

  function onSubmit(data: ProfileEditFormData) {
    const address = (data.street1 || data.city || data.country)
      ? { street1: data.street1, street2: data.street2, city: data.city, state: data.state, postalCode: data.postalCode, country: data.country }
      : undefined

    onSave.mutate({
      path: { person: person?.id || 'me' },
      body: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        middleName: data.middleName || null,
        specialization: data.specialization || null,
        licenseNumber: data.licenseNumber || null,
        prcId: data.prcId || null,
        bio: data.bio || null,
        contactInfo: { email: person?.contactInfo?.email, phone: data.phone || undefined },
        timezone: data.timezone || null,
        preferredLanguage: data.preferredLanguage || null,
        primaryAddress: address,
      },
    })
  }

  function field(label: string, name: keyof ProfileEditFormData, opts?: { placeholder?: string; type?: string }) {
    const errMsg = errors[name]?.message
    return (
      <div>
        <Label htmlFor={name} className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1.5">{label}</Label>
        <Input
          id={name}
          type={opts?.type || 'text'}
          placeholder={opts?.placeholder}
          className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-[4px] focus:ring-[var(--color-primary-subtle)]"
          {...register(name)}
        />
        {errMsg && <p role="alert" className="text-xs text-[var(--color-error)] mt-1">{errMsg}</p>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Edit Profile"
        actions={<Button variant="outline" onClick={onCancel}>Cancel</Button>}
      />

      {error && (
        <div role="alert" className="rounded-[8px] border border-[var(--color-error)] bg-[var(--color-error-bg)] text-[var(--color-error)] p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-h4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('First Name', 'firstName')}
            {field('Last Name', 'lastName')}
          </div>
          {field('Middle Name', 'middleName')}
        </GlassCard>

        {/* Professional */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-h4">Professional</h3>
          {field('Specialization', 'specialization', { placeholder: 'e.g. Orthodontics' })}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('License Number', 'licenseNumber')}
            {field('PRC ID', 'prcId')}
          </div>
          <div>
            <Label htmlFor="bio" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1.5">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell others about your practice and experience..."
              className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-sm min-h-[100px] focus:outline-none focus:border-[var(--color-primary)] focus:ring-[4px] focus:ring-[var(--color-primary-subtle)]"
              {...register('bio')}
            />
          </div>
        </GlassCard>

        {/* Contact */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-h4">Contact</h3>
          <div>
            <Label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1.5">Email</Label>
            <Input
              type="email"
              value={person?.contactInfo?.email || ''}
              disabled
              className="w-full border border-[var(--color-border)] rounded-[8px] px-4 py-[11px] text-sm bg-[var(--color-surface)] opacity-60"
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">Email is managed through your account settings</p>
          </div>
          {field('Phone', 'phone', { placeholder: '+63 917 123 4567' })}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('Timezone', 'timezone', { placeholder: 'Asia/Manila' })}
            {field('Language', 'preferredLanguage', { placeholder: 'en' })}
          </div>
        </GlassCard>

        {/* Address */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-h4">Address</h3>
          {field('Street', 'street1')}
          {field('Street Line 2', 'street2')}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field('City', 'city')}
            {field('State/Province', 'state')}
            {field('Postal Code', 'postalCode')}
          </div>
          {field('Country', 'country', { placeholder: 'PH' })}
        </GlassCard>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={onSave.isPending}>
            {onSave.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
