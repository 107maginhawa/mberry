import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { DateTimePicker } from '@/components/patterns/date-picker'
import {
  createEventMutation,
  updateEventMutation,
  searchEventsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type { EventType, CpdActivityType } from '@monobase/sdk-ts/generated/types.gen'

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
  creditBearing: z.boolean().default(false),
  creditAmount: z.number().min(0).max(40, 'Max 40 CPD hours').refine(
    (val) => val === 0 || (val * 2) % 1 === 0,
    { message: 'Credit amount must be in 0.5 increments' }
  ).default(0),
  cpdActivityType: z.string().optional(),
  coverImageUrl: z.string().optional(),
})

type EventFormData = z.infer<typeof eventSchema>

// ISSUE-030: the Select offers 7 canonical values, but older/imported events
// carry legacy types (medicalMission, generalAssembly, conference, fellowship,
// …). Without normalization the edit Select renders blank. Map known legacy
// values to the nearest canonical option; unknowns degrade to 'custom'. The DB
// enum (migration 0074) now accepts the canonical values, so saving works.
const CANONICAL_EVENT_TYPES = ['assembly', 'seminar', 'social', 'networking', 'fundraiser', 'governance', 'custom']
const LEGACY_EVENT_TYPE_MAP: Record<string, string> = {
  generalAssembly: 'assembly',
  inductionCeremony: 'governance',
  boardMeeting: 'governance',
  committeeMeeting: 'governance',
  fellowship: 'social',
  conference: 'seminar',
  medicalMission: 'custom',
  other: 'custom',
}
function normalizeEventType(stored?: string | null): string {
  if (!stored) return 'assembly'
  if (CANONICAL_EVENT_TYPES.includes(stored)) return stored
  return LEGACY_EVENT_TYPE_MAP[stored] ?? 'custom'
}

const CPD_ACTIVITY_TYPES = [
  { value: 'seminar', label: 'Seminar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'conference', label: 'Conference' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'hands_on', label: 'Hands-on Training' },
  { value: 'community', label: 'Community Service' },
  { value: 'research', label: 'Research' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'self_directed', label: 'Self-Directed Learning' },
  { value: 'other', label: 'Other' },
] as const

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
    creditBearing?: boolean
    creditAmount?: number | null
    cpdActivityType?: string | null
    coverImageUrl?: string | null
  }
  onSuccess?: (event: { id: string }) => void
  onCancel?: () => void
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString()
}

export function EventForm({ orgId, event, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!event

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventFormData>({
    mode: 'onBlur',
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title ?? '',
      eventType: normalizeEventType(event?.eventType),
      description: event?.description ?? '',
      startDate: toDatetimeLocal(event?.startDate),
      endDate: toDatetimeLocal(event?.endDate),
      location: event?.location ?? '',
      registrationFee: event?.registrationFee ? event.registrationFee / 100 : 0,
      capacity: event?.capacity ?? undefined,
      visibility: event?.visibility ?? 'internal',
      status: event?.status ?? 'draft',
      creditBearing: event?.creditBearing ?? false,
      creditAmount: event?.creditAmount ?? 0,
      cpdActivityType: event?.cpdActivityType ?? '',
      coverImageUrl: event?.coverImageUrl ?? '',
    },
  })

  const creditBearing = watch('creditBearing')

  const createMutOpts = createEventMutation()
  const createMut = useMutation({
    mutationFn: createMutOpts.mutationFn,
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err) => toast.error(err.message || 'Failed to create event'),
  })

  const updateMutOpts = updateEventMutation()
  const updateMut = useMutation({
    mutationFn: updateMutOpts.mutationFn,
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err) => toast.error(err.message || 'Failed to update event'),
  })

  const mutation = isEdit ? updateMut : createMut
  const serverError = (mutation.error as Error | null)?.message ?? null

  function submitEvent(data: EventFormData, submitStatus: 'draft' | 'published') {
    const body = {
      title: data.title,
      organizationId: orgId,
      eventType: data.eventType as EventType,
      description: data.description || undefined,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      location: data.location || undefined,
      // ISSUE-017: validator is z.number().int(); the SDK types money as
      // int64→bigint and its bodySerializer stringifies bigint, which the
      // validator rejects ("expected number, received string"). Send a plain
      // integer (cents); the cast bridges the over-wide generated bigint type.
      registrationFee: Math.round((data.registrationFee ?? 0) * 100) as unknown as bigint,
      capacity: data.capacity && !Number.isNaN(data.capacity) ? data.capacity : undefined,
      creditBearing: data.creditBearing,
      creditAmount: data.creditBearing ? data.creditAmount : 0,
      cpdActivityType: data.creditBearing && data.cpdActivityType
        ? (data.cpdActivityType as CpdActivityType)
        : undefined,
      coverImageUrl: data.coverImageUrl || undefined,
      visibility: data.visibility as 'internal' | 'network',
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

      {/* Cover image */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">Cover Image</h3>
        <div className="space-y-2">
          <Label htmlFor="coverImageUrl">Image URL</Label>
          <Input
            id="coverImageUrl"
            placeholder="https://... (jpg, png, webp — max 5MB)"
            {...register('coverImageUrl')}
          />
          <p className="text-xs text-[var(--color-muted)]">
            Upload via Storage module, then paste the URL here. Max 5MB, jpg/png/webp.
          </p>
        </div>
      </div>

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
                    {/* ISSUE-016: values must match backend EventType enum
                        (assembly|seminar|social|networking|fundraiser|governance|custom);
                        the old labels posted values the validator rejected → 400. */}
                    <SelectItem value="assembly">General Assembly</SelectItem>
                    <SelectItem value="seminar">Seminar / CPD</SelectItem>
                    <SelectItem value="social">Social / Fellowship</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="fundraiser">Fundraiser</SelectItem>
                    <SelectItem value="governance">Board / Governance Meeting</SelectItem>
                    <SelectItem value="custom">Other / Custom</SelectItem>
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
            <Label>Start</Label>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  value={field.value ? new Date(field.value).toISOString() : undefined}
                  onValueChange={(iso) => field.onChange(new Date(iso).toISOString())}
                  placeholder="Select start date & time"
                />
              )}
            />
            {errors.startDate && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errors.startDate.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  value={field.value ? new Date(field.value).toISOString() : undefined}
                  onValueChange={(iso) => field.onChange(new Date(iso).toISOString())}
                  placeholder="Select end date & time"
                />
              )}
            />
            {errors.endDate && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
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

      {/* CPD / Credits */}
      <div className="space-y-4">
        <h3 className="text-section-label text-[var(--color-muted)]">
          CPD Credits
        </h3>

        <div className="flex items-center gap-3">
          <Controller
            name="creditBearing"
            control={control}
            render={({ field }) => (
              <Switch
                id="creditBearing"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="creditBearing">This event awards CPD credits</Label>
        </div>

        {creditBearing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cpdActivityType">Activity Type</Label>
              <Controller
                name="cpdActivityType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cpdActivityType" className="w-full">
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CPD_ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditAmount">Credit Hours</Label>
              <Input
                id="creditAmount"
                type="number"
                min="0.5"
                max="40"
                step="0.5"
                placeholder="e.g. 4"
                aria-describedby={errors.creditAmount ? 'creditAmount-error' : undefined}
                {...register('creditAmount', { valueAsNumber: true })}
              />
              {errors.creditAmount && (
                <p id="creditAmount-error" role="alert" className="text-xs text-[var(--color-error)]">
                  {errors.creditAmount.message}
                </p>
              )}
              <p className="text-xs text-[var(--color-muted)]">
                0.5 increments, max 40 hours. 1 unit = 1 hour of learning.
              </p>
            </div>
          </div>
        )}
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
              placeholder="0 = Free"
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
                  <SelectItem value="internal">Members Only</SelectItem>
                  <SelectItem value="network">Public</SelectItem>
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
