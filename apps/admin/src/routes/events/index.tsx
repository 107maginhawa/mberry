import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Search } from 'lucide-react'
import { useState } from 'react'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { RequireRole } from '@/lib/role-gate'
import { searchEventsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/events/')({
  component: () => (
    <RequireRole allowed={['super', 'support']}>
      <EventsPage />
    </RequireRole>
  ),
})

type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled'

interface EventItem {
  id: string
  title: string
  organizationId?: string
  organizationName?: string
  startDate?: string
  endDate?: string
  status?: EventStatus
  registrationCount?: number
  capacity?: number
  location?: string
  isPublic?: boolean
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}

function EventsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading, error } = useQuery(
    searchEventsOptions({
      query: {
        ...(search.length >= 2 ? { q: search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter as EventStatus } : {}),
        limit: 50,
      },
    })
  )

  const events = (data?.data ?? []) as unknown as EventItem[]

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-org event overview for platform support
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-[160px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load events'}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Event</TableHead>
              <TableHead className="p-4 text-sm">Organization</TableHead>
              <TableHead className="p-4 text-sm">Date</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
              <TableHead className="p-4 text-sm text-right">Registrations</TableHead>
              <TableHead className="p-4 text-sm">Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading events...
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No events found{search ? ` matching "${search}"` : ''}</p>
                  {search && <p className="text-xs mt-1">Try a different search term</p>}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="p-4 text-sm font-medium">
                    {event.title}
                    {event.isPublic && (
                      <span className="ml-2 text-xs text-muted-foreground">(public)</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {event.organizationName ?? '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {event.startDate
                      ? new Date(event.startDate).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[event.status ?? ''] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {event.status ?? 'unknown'}
                    </span>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">
                    {event.registrationCount ?? 0}
                    {event.capacity ? ` / ${event.capacity}` : ''}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {event.location ?? '--'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
