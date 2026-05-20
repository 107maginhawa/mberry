import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import {
  createEventMutation,
  updateEventMutation,
  searchEventsQueryKey,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { EventType } from '@monobase/sdk-ts/generated/types.gen'

const eventSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  eventType: z.string().min(1, 'Event type is required'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  location: z.string().optional(),
  registrationFee: z
    .number()
    .min(0, 'Registration fee cannot be negative')
    .default(0),
  capacity: z.union([z.number().int().positive('Capacity must be a positive integer'), z.nan()]).optional(),
  visibility: z.string().default('internal'),
  status: z.string().default('draft'),
})

type EventFormData = z.infer<typeof eventSchema>

interface EventFormProps {
  orgId: string
  event?: {
    id: string
    title: string
    eventType?: string | null
    description?: string | null
    startDate: string
    endDate: string
    location?: string | null
    registrationFee?: number | null
    capacity?: number | null
    visibility?: string | null
    status: string
  }
  onSuccess?: (event: unknown) => void
  onCancel?: () => void
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

export function EventForm({ orgId, event, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!event

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title ?? '',
      eventType: event?.eventType ?? 'other',
      description: event?.description ?? '',
      startDate: toDatetimeLocal(event?.startDate),
      endDate: toDatetimeLocal(event?.endDate),
      location: event?.location ?? '',
      registrationFee: event?.registrationFee ? event.registrationFee / 100 : 0,
      capacity: event?.capacity ?? undefined,
      visibility: event?.visibility ?? 'internal',
      status: event?.status ?? 'draft',
    },
  })

  const createMutOpts = createEventMutation()
  const createMut = useMutation({
    mutationFn: createMutOpts.mutationFn,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
  })

  const updateMutOpts = updateEventMutation()
  const updateMut = useMutation({
    mutationFn: updateMutOpts.mutationFn,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
  })

  const mutation = isEdit ? updateMut : createMut
  const serverError = (mutation.error as Error | null)?.message ?? null

  function submitEvent(data: EventFormData, submitStatus: 'draft' | 'published') {
    const body = {
      title: data.title,
      organizationId: orgId,
      // Form stores eventType as string; cast to the generated union for the API call
      eventType: data.eventType as EventType,
      description: data.description || undefined,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      location: data.location || undefined,
      registrationFee: Math.round((data.registrationFee ?? 0) * 100),
      capacity: data.capacity && !Number.isNaN(data.capacity) ? data.capacity : undefined,
      creditBearing: false,
    }
    if (isEdit) {
      updateMut.mutate({ path: { eventId: event!.id }, body })
    } else {
      createMut.mutate({ body })
    }
  }

  return (
    <form
      onSubmit={handleSubmit((data) => submitEvent(data, data.status as 'draft' | 'published'))}
      className="space-y-6"
    >
      {serverError && (
        <div role="alert" aria-live="polite" className="p-3 rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">{serverError}</div>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">
          Basic Info
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="e.g. Annual General Assembly 2025"
              aria-describedby={errors.title ? 'title-error' : undefined}
              {...register('title')}
            />
            {errors.title && (
              <p id="title-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Controller
              name="eventType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="eventType" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_assembly">General Assembly</SelectItem>
                    <SelectItem value="induction_ceremony">Induction</SelectItem>
                    <SelectItem value="fellowship">Fellowship</SelectItem>
                    <SelectItem value="medical_mission">Medical Mission</SelectItem>
                    <SelectItem value="board_meeting">Board Meeting</SelectItem>
                    <SelectItem value="committee_meeting">Committee Meeting</SelectItem>
                    <SelectItem value="fundraiser">Fundraiser</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Event details, agenda, notes..."
              rows={4}
              {...register('description')}
            />
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">
          Date &amp; Time
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start</Label>
            <Input
              id="startDate"
              type="datetime-local"
              aria-describedby={errors.startDate ? 'startDate-error' : undefined}
              {...register('startDate')}
            />
            {errors.startDate && (
              <p id="startDate-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.startDate.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End</Label>
            <Input
              id="endDate"
              type="datetime-local"
              aria-describedby={errors.endDate ? 'endDate-error' : undefined}
              {...register('endDate')}
            />
            {errors.endDate && (
              <p id="endDate-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.endDate.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">
          Location
        </h3>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="e.g. Manila Hotel Ballroom or https://meet.google.com/..."
            {...register('location')}
          />
        </div>
      </div>

      {/* Registration */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">
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
              placeholder="0"
              aria-describedby={errors.registrationFee ? 'registrationFee-error' : undefined}
              {...register('registrationFee', { valueAsNumber: true })}
            />
            {errors.registrationFee && (
              <p id="registrationFee-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.registrationFee.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (leave blank for unlimited)</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              placeholder="Unlimited"
              {...register('capacity', { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Visibility — BR-16 */}
        <div className="space-y-1.5">
          <Label htmlFor="visibility">Visibility</Label>
          <Controller
            name="visibility"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="visibility" className="w-full">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (this org only)</SelectItem>
                  <SelectItem value="network">Network-Wide (all orgs in association)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          variant="outline"
          onClick={() => setValue('status', 'draft')}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setValue('status', 'published')
            handleSubmit((data) => submitEvent(data, 'published'))()
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Publishing...' : 'Publish'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
