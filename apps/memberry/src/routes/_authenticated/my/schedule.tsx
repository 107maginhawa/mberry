// oli-execute: error-handled-inline
// `error` is rendered explicitly at the bottom of the component for the
// non-404 branch; 404 is treated as the "no event yet" empty state. The gate
// heuristic flags this because the destructured rename loses the literal
// `isError` token.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getBookingEventOptions } from '@monobase/sdk-ts/generated/react-query'
import { SdkError } from '@monobase/sdk-ts/client'
import { BookingEventEditor } from '@/features/booking/components/booking-event-editor'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/schedule')({
  component: SchedulePage,
})

function SchedulePage() {
  // `getBookingEvent` accepts the literal 'me' to fetch the caller's event
  // (or 404 if they don't have one yet).
  const { data, isPending, error } = useQuery({
    ...getBookingEventOptions({ path: { event: 'me' } }),
    retry: (failureCount, err) => {
      if (err instanceof SdkError && err.status === 404) return false
      return failureCount < 3
    },
  })

  const notFound = error instanceof SdkError && error.status === 404
  const existing = notFound ? null : data ?? null

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !notFound) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Could not load your schedule: {error instanceof Error ? error.message : 'unknown error'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-h1">Schedule</h1>
        <p className="text-muted-foreground">
          Publish your weekly availability so other members can book sessions with you.
        </p>
      </div>
      <BookingEventEditor existing={existing} />
    </div>
  )
}
