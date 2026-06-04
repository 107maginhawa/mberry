import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonOptions, updatePersonMutation, createPersonMutation } from '@monobase/sdk-ts/generated/react-query'
import { formatPersonName, formatLicenseDisplay } from '@/features/profile/lib/profile-display'
import { zodResolver } from '@/lib/zod-resolver'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageShell } from '@/components/patterns/page-shell'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { StatusBadge } from '@/components/patterns/status-badge'
import { ProfileSkeleton } from '@/components/patterns/skeleton-loader'
import { EmptyState } from '@/components/patterns/empty-state'
import { Button, Input, Label, Textarea, NavIcon } from '@monobase/ui'
import { Shield, Lock, CreditCard, Download, UserCircle, Eye, EyeOff, Globe, Award, ShieldCheck, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'
import { TrustBadges, type TrustSignals } from '@/features/profile/components/trust-badges'
import { StandingMeter } from '@/features/profile/components/standing-meter'

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

  // Directory profile for current user (for publish/preview)
  const { data: directoryProfile, refetch: refetchDirectory } = useQuery({
    queryKey: ['my-directory-profile'],
    queryFn: async () => {
      const res = await api.get<any>('/api/association/member/directory/search?q=&limit=50')
      const me = (res?.data ?? []).find((p: any) => p.personId === person?.id)
      return me ?? null
    },
    enabled: !!person?.id,
  })

  const [previewMode, setPreviewMode] = useState(false)

  const publishMutation = useMutation({
    mutationFn: async (visibility: 'public' | 'memberOnly' | 'hidden') => {
      if (directoryProfile?.id) {
        await api.patch(`/api/association/member/directory/profiles/${directoryProfile.id}`, { visibility })
      } else {
        await api.post('/api/association/member/directory/profiles', {
          personId: person?.id,
          displayName: formatPersonName(person?.firstName || '', person?.lastName, person?.middleName),
          specialty: person?.specialization || undefined,
          visibility,
        })
      }
    },
    onSuccess: () => {
      refetchDirectory()
      toast.success('Directory visibility updated')
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to update directory visibility')
    },
  })

  // Professional licenses
  const { data: myLicenses = [] } = useQuery({
    queryKey: ['my-licenses'],
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>(`/api/association/member/licenses?personId=${encodeURIComponent(person?.id || '')}`)
      return res?.data ?? []
    },
    enabled: !!person?.id,
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
      <PageShell title="Profile">
        <EmptyState
          icon={<UserCircle size={40} />}
          headline="No profile found"
          description="Complete onboarding to create your professional profile."
        />
      </PageShell>
    )
  }

  const p = person

  if (editing) {
    return <ProfileEditForm person={p} onCancel={() => { setEditing(false); setError(null) }} onSave={mutation} error={error} />
  }

  return (
    <PageShell
      title="Profile"
      subtitle="Your professional identity"
      actions={
        <Button onClick={() => setEditing(true)}>
          Edit Profile
        </Button>
      }
    >
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/3 flex flex-col items-center md:items-start">
          <div data-testid="profile-avatar">
            <AvatarInitials
              name={formatPersonName(p?.firstName || '?', p?.lastName, p?.middleName)}
              size="lg"
              photoUrl={p?.avatar?.url}
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
          {/* Standing meter */}
          <StandingMeter
            person={p}
            duesStatus={memberships.some((m: MembershipItem) => m.status === 'active') ? 'current' : null}
            onAction={() => setEditing(true)}
          />

          {/* Bio */}
          <GlassCard className="p-5">
            <h3 className="text-h4 mb-2">About</h3>
            {p?.bio ? (
              <p className="text-sm text-[var(--color-muted)] whitespace-pre-line">{p.bio}</p>
            ) : (
              <div className="text-center py-3">
                <p className="text-sm text-[var(--color-muted)] mb-2">Tell others about your practice</p>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Add Bio
                </Button>
              </div>
            )}
          </GlassCard>

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
          <GlassCard className="p-5">
            <h3 className="text-h4 mb-3">Organizations</h3>
            {memberships.length > 0 ? (
              <div className="space-y-2">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{m.orgName}</span>
                    <StatusBadge status={m.status ?? 'pending'} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)] text-center py-3">No organization memberships yet</p>
            )}
          </GlassCard>

          {/* Directory Profile */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h4 flex items-center gap-2">                <NavIcon icon={Globe} /> Directory Profile
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className="text-xs"
              >
                {previewMode ? <><EyeOff size={14} className="mr-1" /> Exit Preview</> : <><Eye size={14} className="mr-1" /> Preview Public</>}
              </Button>
            </div>

            {previewMode ? (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
                <p className="text-xs text-[var(--color-muted)] mb-2">This is how others see your directory profile:</p>
                <div className="flex items-center gap-3">
                  <AvatarInitials
                    name={formatPersonName(p?.firstName || '?', p?.lastName, p?.middleName)}
                    size="md"
                    photoUrl={p?.avatar?.url}
                  />
                  <div>
                    <p className="font-semibold">{formatPersonName(p?.firstName || '', p?.lastName, p?.middleName)}</p>
                    {p?.specialization && <p className="text-xs text-[var(--color-muted)]">{p.specialization}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-muted)]">
                    Visibility: <span className="font-medium text-[var(--color-text)]">{directoryProfile?.visibility || 'hidden'}</span>
                  </span>
                  {(!directoryProfile || directoryProfile.visibility === 'hidden') ? (
                    <Button
                      size="sm"
                      onClick={() => publishMutation.mutate('memberOnly')}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish to Directory'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => publishMutation.mutate('hidden')}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? 'Hiding...' : 'Hide from Directory'}
                    </Button>
                  )}
                </div>
                {directoryProfile?.visibility === 'memberOnly' && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0"
                    onClick={() => publishMutation.mutate('public')}
                    disabled={publishMutation.isPending}
                  >
                    Make public (visible without login)
                  </Button>
                )}
              </div>
            )}
          </GlassCard>

          {/* Professional Licenses */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h4 flex items-center gap-2">                <NavIcon icon={Award} /> Professional Licenses
              </h3>
            </div>
            {myLicenses.length > 0 ? (
              <div className="space-y-2">
                {myLicenses.map((lic: any) => (
                  <div key={lic.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{lic.licenseType}</span>
                        {lic.verifiedAt ? (
                          <ShieldCheck className="w-4 h-4 text-[var(--color-success)]" />
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--color-muted)]">{lic.licenseNumber} • {lic.issuingAuthority}</p>
                    </div>
                    <StatusBadge status={lic.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)] text-center py-3">
                No professional licenses on record.
                Licenses can be added by your organization's officers.
              </p>
            )}
          </GlassCard>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/my/settings" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">              <NavIcon icon={Shield} className="text-[var(--color-muted)]" /> Privacy
            </Link>
            <Link to="/settings/security" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">              <NavIcon icon={Lock} className="text-[var(--color-muted)]" /> Security
            </Link>
            <Link to="/my/id-card" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">              <NavIcon icon={CreditCard} className="text-[var(--color-muted)]" /> ID Card
            </Link>
            <Link to="/my/data-export" className="flex items-center gap-2 rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] p-4 hover:bg-[var(--color-surface-elevated-hover)] hover:shadow-soft transition-all text-sm font-semibold">              <NavIcon icon={Download} className="text-[var(--color-muted)]" /> Data Export
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
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
    <PageShell
      title="Edit Profile"
      actions={<Button variant="outline" onClick={onCancel}>Cancel</Button>}
    >
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
    </PageShell>
  )
}
