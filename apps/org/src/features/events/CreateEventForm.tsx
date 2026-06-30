import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useCreateEvent } from './use-create-event'

const EVENT_TYPES = ['assembly', 'seminar', 'social', 'networking', 'fundraiser', 'governance', 'custom'] as const

export function CreateEventForm({ onCreated }: { onCreated?: () => void } = {}) {
  const { orgId } = useSelectedOrg()
  const create = useCreateEvent(orgId)
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<string>('assembly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [feePhp, setFeePhp] = useState('')
  const [description, setDescription] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  const serverMessage = create.isError ? (create.error?.message ?? 'Could not create the event.') : null
  const alertMessage = clientError ?? serverMessage

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientError(null)
    if (!orgId) return
    if (!title || !start || !end) { setClientError('Title, start, and end are required.'); return }
    if (new Date(end) < new Date(start)) { setClientError('End time must be after the start time.'); return }
    if (new Date(start) < new Date()) { setClientError('The event start time cannot be in the past.'); return }
    const fee = feePhp ? Number(feePhp) : undefined
    if (fee !== undefined && (Number.isNaN(fee) || fee < 0)) { setClientError('Fee must be a non-negative amount.'); return }
    create.mutate(
      {
        title, eventType,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        ...(location ? { location } : {}),
        ...(capacity ? { capacity: Number(capacity) } : {}),
        ...(fee !== undefined ? { feePhp: fee } : {}),
        ...(description ? { description } : {}),
      },
      {
        onSuccess: () => {
          // New events default to draft — tell the officer where to find + publish it
          // (the list defaults to the Upcoming tab, which hides drafts).
          toast.success('Event saved as a draft — open the Drafts tab to publish it')
          setTitle(''); setStart(''); setEnd(''); setLocation(''); setCapacity(''); setFeePhp(''); setDescription('')
          onCreated?.()
        },
        onError: () => toast.error('Could not create the event'),
      },
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create event</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-body text-muted-foreground">
          Creating events requires a Society Officer or President; the President/Treasurer/Secretary roles also
          require two-factor authentication in production.
        </p>
        {!orgId && <p className="text-body text-muted-foreground">Select an organization first.</p>}
        {alertMessage && <p role="alert" className="mb-3 text-body text-destructive">{alertMessage}</p>}
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Grouped into ≤4-field sections (DESIGN.md: chunk the form, one decision at a time). */}
          <fieldset className="space-y-4">
            <legend className="text-body font-semibold text-foreground mb-2">Basics</legend>
            <div><Label htmlFor="ev-title">Title</Label><Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div>
              <Label htmlFor="ev-type">Type</Label>
              {/* ponytail: native <select> on purpose — @monobase/ui Select is Radix (36px trigger < 48px a11y floor,
                  and not drivable via getByLabelText+fireEvent.change in tests). Native is taller + keyboard/label native. */}
              <select id="ev-type" value={eventType} onChange={(e) => setEventType(e.target.value)}
                className="min-h-tap w-full rounded-md border bg-background px-3 text-body">
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-body font-semibold text-foreground mb-2">When</legend>
            <div><Label htmlFor="ev-start">Start</Label><Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            <div><Label htmlFor="ev-end">End</Label><Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-body font-semibold text-foreground mb-2">Details (optional)</legend>
            <div><Label htmlFor="ev-loc">Location</Label><Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div><Label htmlFor="ev-cap">Capacity</Label><Input id="ev-cap" type="number" min={1} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
            <div>
              <Label htmlFor="ev-fee">Registration fee in PHP</Label>
              <Input id="ev-fee" type="number" min={0} step="0.01" value={feePhp} onChange={(e) => setFeePhp(e.target.value)} />
              {/* Honest warning at the fee field (design Round-2 #6) — paid events run on card billing,
                  which isn't set up on the lean PayMongo rail yet. Non-blocking: a paid draft can be
                  created; only publish is gated server-side. */}
              {Number(feePhp) > 0 && (
                // Advisory (not an error) → aria-live polite, not role=alert.
                <p aria-live="polite" className="mt-1 text-caption text-warning">
                  Paid events need card setup, which isn’t available yet (PayMongo coming soon). You can save this as a
                  draft, but publishing a paid event won’t work until billing is set up.
                </p>
              )}
            </div>
            <div><Label htmlFor="ev-desc">Description</Label><Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </fieldset>

          <Button type="submit" disabled={!orgId || create.isPending} className="min-h-tap">
            {create.isPending ? 'Creating…' : 'Create event'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
