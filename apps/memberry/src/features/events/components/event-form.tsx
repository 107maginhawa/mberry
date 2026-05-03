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
    description?: string | null
    startDate: string
    endDate: string
    location?: string | null
    registrationFee?: number | null
    capacity?: number | null
    status: string
  }
  onSuccess?: (event: any) => void
  onCancel?: () => void
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

export function EventForm({ orgId, event, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!event

  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    startDate: toDatetimeLocal(event?.startDate),
    endDate: toDatetimeLocal(event?.endDate),
    location: event?.location ?? '',
    registrationFee: event?.registrationFee ? String(event.registrationFee / 100) : '0',
    capacity: event?.capacity ? String(event.capacity) : '',
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

      const body = {
        title: form.title,
        description: form.description || null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        location: form.location || null,
        registrationFee: Math.round(parseFloat(form.registrationFee || '0') * 100),
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
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
            <Label htmlFor="startDate">Start</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
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
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Manila Hotel Ballroom or https://meet.google.com/..."
          />
        </div>
      </div>

      {/* Registration */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Registration
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="registrationFee">Registration Fee (PHP)</Label>
            <Input
              id="registrationFee"
              type="number"
              min="0"
              step="0.01"
              value={form.registrationFee}
              onChange={(e) => set('registrationFee', e.target.value)}
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

        {/* Visibility — BR-16 */}
        <div className="space-y-1.5">
          <Label htmlFor="visibility">Visibility</Label>
          <select
            id="visibility"
            value={form.visibility}
            onChange={(e) => set('visibility', e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="internal">Internal (this org only)</option>
            <option value="network">Network-Wide (all orgs in association)</option>
          </select>
        </div>
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
