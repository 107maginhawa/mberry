import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui'
import { HostDirectory } from '@/features/booking/components/host-directory'
import { BookingList } from '@/features/booking/components/booking-list'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/my/bookings/')({
  component: BookingsPage,
})

function BookingsPage() {
  // Resolve the signed-in person via a live query rather than the router
  // context's `auth.person` snapshot — that snapshot is undefined on a cold
  // direct navigation, which previously wedged the "My bookings" tab on a
  // permanent "Loading…" state.
  const { data: person } = useQuery({
    queryKey: ['persons', 'me'],
    queryFn: () => api.get<{ id?: string }>('/api/persons/me'),
    staleTime: 5 * 60_000,
  })
  const myPersonId = person?.id

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1">Bookings</h1>
        <p className="text-muted-foreground">
          Find a host or manage the sessions you're part of.
        </p>
      </div>

      <Tabs defaultValue="find" className="w-full">
        <TabsList>
          <TabsTrigger value="find">Find a host</TabsTrigger>
          <TabsTrigger value="my">My bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="find" className="mt-4">
          <HostDirectory />
        </TabsContent>
        <TabsContent value="my" className="mt-4">
          {myPersonId ? (
            <BookingList myPersonId={myPersonId} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
