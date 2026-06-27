import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { createEvent, type EventCreateRequest, type Event } from '@monobase/sdk-ts/generated'

export interface CreateEventInput {
  title: string
  eventType: string
  startDate: string // ISO
  endDate: string   // ISO
  location?: string
  capacity?: number
  feePhp?: number
  description?: string
}

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useCreateEvent(orgId: string | null): UseMutationResult<Event, Error, CreateEventInput> {
  return useMutation<Event, Error, CreateEventInput>({
    mutationFn: async (input) => {
      if (!orgId) throw new Error('No organization selected.')
      // EventCreateRequest types registrationFee as bigint + dates as Date (see use-send-link.ts house pattern).
      const fee = input.feePhp && input.feePhp > 0 ? BigInt(Math.round(input.feePhp * 100)) : undefined
      const body: EventCreateRequest = {
        organizationId: orgId,
        title: input.title,
        eventType: input.eventType as EventCreateRequest['eventType'],
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        creditBearing: false,
        ...(fee !== undefined ? { registrationFee: fee, currency: 'PHP' } : {}),
        ...(input.capacity ? { capacity: input.capacity } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.description ? { description: input.description } : {}),
      }
      const { data, error } = await createEvent({ body })
      if (!data) throw new Error(serverError(error) ?? 'Could not create the event.')
      return data as Event
    },
  })
}
