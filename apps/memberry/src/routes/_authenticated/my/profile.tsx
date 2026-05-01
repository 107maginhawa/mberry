import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonOptions, updatePersonMutation } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { formatPersonName, formatLicenseDisplay, getInitials } from '@/features/profile/lib/profile-display'
import { useState } from 'react'

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

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading profile...</div>

  if (isError || !person) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <div className="border rounded-lg p-6 text-center text-muted-foreground">
          <p>No profile found. Complete onboarding to create your profile.</p>
        </div>
      </div>
    )
  }

  const p = person as any

  if (editing) {
    return <ProfileEditForm person={p} onCancel={() => { setEditing(false); setError(null) }} onSave={mutation} error={error} />
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <button
          onClick={() => setEditing(true)}
          className="rounded-md bg-[#554B68] px-4 py-2 text-sm font-medium text-white hover:bg-[#443b55] transition-colors"
        >
          Edit Profile
        </button>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#554B68] text-white flex items-center justify-center text-xl font-bold">
            {getInitials(p?.firstName || '?', p?.lastName)}
          </div>
          <div>
            <div className="text-lg font-medium">
              {formatPersonName(p?.firstName || '', p?.lastName, p?.middleName)}
            </div>
            {p?.specialization && (
              <div className="text-sm text-muted-foreground">{p.specialization}</div>
            )}
            {formatLicenseDisplay(p?.licenseNumber, p?.prcId) && (
              <div className="text-xs text-muted-foreground">
                {formatLicenseDisplay(p.licenseNumber, p.prcId)}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm">
          {p?.contactInfo?.email && (
            <div><span className="font-medium">Email:</span> {p.contactInfo.email}</div>
          )}
          {p?.contactInfo?.phone && (
            <div><span className="font-medium">Phone:</span> {p.contactInfo.phone}</div>
          )}
          {p?.timezone && (
            <div><span className="font-medium">Timezone:</span> {p.timezone}</div>
          )}
          {p?.preferredLanguage && (
            <div><span className="font-medium">Language:</span> {p.preferredLanguage}</div>
          )}
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
          email: person?.contactInfo?.email, // don't change email here
          phone: form.phone || undefined,
        },
        timezone: form.timezone || null,
        preferredLanguage: form.preferredLanguage || null,
      },
    })
  }

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#554B68]/50"
      />
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <button
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="border border-destructive/50 bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('First Name', 'firstName')}
          {field('Last Name', 'lastName')}
        </div>
        {field('Middle Name', 'middleName')}

        <hr />

        {field('Specialization', 'specialization', { placeholder: 'e.g. Orthodontics' })}
        <div className="grid grid-cols-2 gap-4">
          {field('License Number', 'licenseNumber')}
          {field('PRC ID', 'prcId')}
        </div>

        <hr />

        {field('Phone', 'phone', { placeholder: '+63 ...' })}
        {field('Timezone', 'timezone', { placeholder: 'Asia/Manila' })}
        {field('Preferred Language', 'preferredLanguage', { placeholder: 'en' })}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={onSave.isPending || !form.firstName}
            className="rounded-md bg-[#554B68] px-4 py-2 text-sm font-medium text-white hover:bg-[#443b55] disabled:opacity-50 transition-colors"
          >
            {onSave.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
