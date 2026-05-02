import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface EventFormProps {
  orgId: string
  event?: {
    id: string
    title: string
    type: string
    description?: string | null
    startAt: string
    endAt: string
    locationType: string
    locationDetails?: { venue?: string; address?: string; meetingUrl?: string } | null
    coverImage?: string | null
    registrationEnabled: boolean
    fee?: number | null
    capacity?: number | null
    qrEnabled: boolean
    visibility: string
    status: string
  }
  onSuccess?: (event: any) => void
  onCancel?: () => void
}

const EVENT_TYPES = [
  { value: 'general_assembly', label: 'General Assembly' },
  { value: 'induction_ceremony', label: 'Induction Ceremony' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'medical_mission', label: 'Medical Mission' },
  { value: 'board_meeting', label: 'Board Meeting' },
  { value: 'committee_meeting', label: 'Committee Meeting' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'other', label: 'Other' },
]

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

export function EventForm({ orgId, event, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!event

  const [form, setForm] = useState({
    title: event?.title ?? '',
    type: event?.type ?? 'general_assembly',
    description: event?.description ?? '',
    startAt: toDatetimeLocal(event?.startAt),
    endAt: toDatetimeLocal(event?.endAt),
    locationType: event?.locationType ?? 'in_person',
    venue: event?.locationDetails?.venue ?? '',
    address: event?.locationDetails?.address ?? '',
    meetingUrl: event?.locationDetails?.meetingUrl ?? '',
    coverImage: event?.coverImage ?? '',
    registrationEnabled: event?.registrationEnabled ?? true,
    fee: event?.fee ? String(event.fee / 100) : '0',
    capacity: event?.capacity ? String(event.capacity) : '',
    qrEnabled: event?.qrEnabled ?? true,
    visibility: event?.visibility ?? 'internal',
    status: event?.status ?? 'draft',
  })

  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (submitStatus: 'draft' | 'published') => {
      const url = isEdit
        ? `/api/events/update/${event.id}`
        : `/api/events/create/${orgId}`
      const method = isEdit ? 'PUT' : 'POST'

      const locationDetails: Record<string, string> = {}
      if (form.locationType === 'in_person') {
        if (form.venue) locationDetails.venue = form.venue
        if (form.address) locationDetails.address = form.address
      } else {
        if (form.meetingUrl) locationDetails.meetingUrl = form.meetingUrl
      }

      const body = {
        title: form.title,
        type: form.type,
        description: form.description || null,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        locationType: form.locationType,
        locationDetails,
        coverImage: form.coverImage || null,
        registrationEnabled: form.registrationEnabled,
        fee: Math.round(parseFloat(form.fee || '0') * 100),
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        qrEnabled: form.qrEnabled,
        visibility: form.visibility,
        status: submitStatus,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? 'Failed to save event')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events', orgId] })
      onSuccess?.(data.data)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const set = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        mutation.mutate(form.status as 'draft' | 'published')
      }}
      className="space-y-6"
    >
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Basic Info
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Annual General Assembly 2025"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              required
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              value={form.visibility}
              onChange={(e) => set('visibility', e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="internal">Internal (members only)</option>
              <option value="network">Network (public)</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Event details, agenda, notes..."
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Date &amp; Time
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startAt">Start</Label>
            <Input
              id="startAt"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => set('startAt', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endAt">End</Label>
            <Input
              id="endAt"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => set('endAt', e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Location
        </h3>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationType"
              value="in_person"
              checked={form.locationType === 'in_person'}
              onChange={() => set('locationType', 'in_person')}
            />
            <span className="text-sm">In-person</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationType"
              value="online"
              checked={form.locationType === 'online'}
              onChange={() => set('locationType', 'online')}
            />
            <span className="text-sm">Online</span>
          </label>
        </div>

        {form.locationType === 'in_person' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue">Venue Name</Label>
              <Input
                id="venue"
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder="e.g. Manila Hotel Ballroom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Full address"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="meetingUrl">Meeting URL</Label>
            <Input
              id="meetingUrl"
              type="url"
              value={form.meetingUrl}
              onChange={(e) => set('meetingUrl', e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </div>
        )}
      </div>

      {/* Cover Image */}
      <div className="space-y-2">
        <Label htmlFor="coverImage">Cover Image URL</Label>
        <Input
          id="coverImage"
          type="url"
          value={form.coverImage}
          onChange={(e) => set('coverImage', e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Registration */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Registration
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.registrationEnabled}
            onChange={(e) => set('registrationEnabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable member registration</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fee">Registration Fee (PHP)</Label>
            <Input
              id="fee"
              type="number"
              min="0"
              step="0.01"
              value={form.fee}
              onChange={(e) => set('fee', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (leave blank for unlimited)</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.qrEnabled}
            onChange={(e) => set('qrEnabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable QR code check-in</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          onClick={() => set('status', 'draft')}
          disabled={mutation.isPending}
          className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null)
            set('status', 'published')
            mutation.mutate('published')
          }}
          disabled={mutation.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Publishing...' : 'Publish'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
