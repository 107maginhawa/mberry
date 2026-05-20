import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import { Pencil, X, Save, Globe, Mail, Phone, MapPin, Calendar, Image } from 'lucide-react'

interface OrgSettingsFormProps {
  orgId: string
}

interface OrgProfile {
  name: string
  description: string
  logoUrl: string
  contactEmail: string
  phone: string
  address: string
  website: string
  foundingDate: string
}

const EMPTY_PROFILE: OrgProfile = {
  name: '',
  description: '',
  logoUrl: '',
  contactEmail: '',
  phone: '',
  address: '',
  website: '',
  foundingDate: '',
}

async function fetchOrgProfile(orgId: string): Promise<OrgProfile> {
  try {
    const json = await api.get<any>(`/api/membership/org-profile/${orgId}`)
    const org = json.data || json
    return {
      name: org.name || '',
      description: org.description || '',
      logoUrl: org.logoUrl || '',
      contactEmail: org.contactEmail || '',
      phone: org.phone || '',
      address: org.address || '',
      website: org.website || '',
      foundingDate: org.foundingDate || '',
    }
  } catch { /* fall through */ }
  return {
    name: '',
    description: '',
    logoUrl: '',
    contactEmail: '',
    phone: '',
    address: '',
    website: '',
    foundingDate: '',
  }
}

export function OrgSettingsForm({ orgId }: OrgSettingsFormProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<OrgProfile>(EMPTY_PROFILE)

  const { data: saved = EMPTY_PROFILE, isLoading } = useQuery({
    queryKey: ['org-profile', orgId],
    queryFn: () => fetchOrgProfile(orgId),
  })

  // Sync draft when saved data loads/changes
  useEffect(() => {
    if (!isEditing) setDraft(saved)
  }, [saved, isEditing])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function handleEdit() {
    setDraft(saved)
    setIsEditing(true)
  }

  function handleCancel() {
    setDraft(saved)
    setIsEditing(false)
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    setIsSaving(true)
    try {
      await api.put(`/api/membership/org-profile/${orgId}`, { name: draft.name, contactEmail: draft.contactEmail })
      queryClient.invalidateQueries({ queryKey: ['org-profile', orgId] })
      setIsEditing(false)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  function set(field: keyof OrgProfile, value: string) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const current = isEditing ? draft : saved

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-h4">Organization Profile</h2>
        {!isEditing ? (
          <Button size="sm" variant="outline" onClick={handleEdit}>
            <Pencil size={14} className="mr-1.5" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X size={14} className="mr-1.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
              <Save size={14} className="mr-1.5" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Logo URL */}
        <div className="md:col-span-2 space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Image size={13} className="text-[var(--color-muted)]" />
            Logo URL
          </Label>
          {isEditing ? (
            <Input
              value={draft.logoUrl}
              onChange={(e) => set('logoUrl', e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          ) : (
            <FieldValue value={current.logoUrl} placeholder="No logo URL set" />
          )}
        </div>

        {/* Name */}
        <div className="md:col-span-2 space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Organization Name <span className="text-[var(--color-error)]">*</span>
          </Label>
          {isEditing ? (
            <Input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Philippine Dental Association"
            />
          ) : (
            <FieldValue value={current.name} />
          )}
        </div>

        {/* Description */}
        <div className="md:col-span-2 space-y-1.5">
          <Label>Description</Label>
          {isEditing ? (
            <Textarea
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Brief description of the organization"
            />
          ) : (
            <FieldValue value={current.description} placeholder="No description set" />
          )}
        </div>

        {/* Contact Email */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Mail size={13} className="text-[var(--color-muted)]" />
            Contact Email
          </Label>
          {isEditing ? (
            <Input
              type="email"
              value={draft.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
              placeholder="contact@org.com"
            />
          ) : (
            <FieldValue value={current.contactEmail} placeholder="Not set" />
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Phone size={13} className="text-[var(--color-muted)]" />
            Phone
          </Label>
          {isEditing ? (
            <Input
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+63 2 8123 4567"
            />
          ) : (
            <FieldValue value={current.phone} placeholder="Not set" />
          )}
        </div>

        {/* Address */}
        <div className="md:col-span-2 space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <MapPin size={13} className="text-[var(--color-muted)]" />
            Address
          </Label>
          {isEditing ? (
            <Input
              value={draft.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="123 Main Street, City, Country"
            />
          ) : (
            <FieldValue value={current.address} placeholder="Not set" />
          )}
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Globe size={13} className="text-[var(--color-muted)]" />
            Website
          </Label>
          {isEditing ? (
            <Input
              type="url"
              value={draft.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://org.example.com"
            />
          ) : current.website ? (
            <a
              href={current.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-[var(--color-primary)] underline"
            >
              {current.website}
            </a>
          ) : (
            <FieldValue value="" placeholder="Not set" />
          )}
        </div>

        {/* Founding Date */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--color-muted)]" />
            Founding Date
          </Label>
          {isEditing ? (
            <Input
              type="date"
              value={draft.foundingDate}
              onChange={(e) => set('foundingDate', e.target.value)}
            />
          ) : (
            <FieldValue
              value={current.foundingDate ? new Date(current.foundingDate).toLocaleDateString() : ''}
              placeholder="Not set"
            />
          )}
        </div>
      </div>

      {isEditing && isDirty && (
        <p className="text-[12px] text-[var(--color-warning)] mt-4">You have unsaved changes.</p>
      )}
    </div>
  )
}

function FieldValue({ value, placeholder = '—' }: { value: string; placeholder?: string }) {
  return (
    <p className={`text-[14px] py-2 ${value ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}>
      {value || placeholder}
    </p>
  )
}
