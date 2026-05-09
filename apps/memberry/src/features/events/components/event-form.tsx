import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import {
  createEventMutation,
  updateEventMutation,
  searchEventsQueryKey,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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
    visibility?: string | null
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
    eventType: (event as any)?.eventType ?? 'other',
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

  const createMutOpts = createEventMutation()
  const createMut = useMutation({
    mutationFn: createMutOpts.mutationFn,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err: Error) => { setError(err.message) },
  })

  const updateMutOpts = updateEventMutation()
  const updateMut = useMutation({
    mutationFn: updateMutOpts.mutationFn,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err: Error) => { setError(err.message) },
  })

  const mutation = isEdit ? updateMut : createMut

  function submitEvent(submitStatus: 'draft' | 'published') {
    const body: any = {
      title: form.title,
      organizationId: orgId,
      eventType: form.eventType as any,
      description: form.description || undefined,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      location: form.location || undefined,
      registrationFee: Math.round(parseFloat(form.registrationFee || '0') * 100),
      capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
      creditBearing: false,
    }
    if (isEdit) {
      updateMut.mutate({ path: { eventId: event!.id }, body })
    } else {
      createMut.mutate({ body })
    }
  }

  const set = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        submitEvent(form.status as 'draft' | 'published')
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
            <Label htmlFor="eventType">Event Type</Label>
            <select
              id="eventType"
              value={form.eventType}
              onChange={(e) => set('eventType', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="general_assembly">General Assembly</option>
              <option value="induction_ceremony">Induction</option>
              <option value="fellowship">Fellowship</option>
              <option value="medical_mission">Medical Mission</option>
              <option value="board_meeting">Board Meeting</option>
              <option value="committee_meeting">Committee Meeting</option>
              <option value="fundraiser">Fundraiser</option>
              <option value="other">Other</option>
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
            submitEvent('published')
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
