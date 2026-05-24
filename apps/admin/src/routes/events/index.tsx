import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Search, ExternalLink, Download, Users } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { RequireRole } from '@/lib/role-gate'
import { searchEventsOptions, listOrganizationsOptions, listCustomEventRegistrationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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

const PAGE_SIZE = 25

function EventsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'registrations'>('details')

  const { data, isLoading, error } = useQuery(
    searchEventsOptions({
      query: {
        ...(search.length >= 2 ? { q: search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter as EventStatus } : {}),
        ...(orgFilter !== 'all' ? { organizationId: orgFilter } : {}),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
    })
  )

  const { data: orgsData } = useQuery(listOrganizationsOptions())
  const organizations = (orgsData?.data ?? []) as unknown as { id: string; name: string }[]

  const events = (data?.data ?? []) as unknown as EventItem[]
  const hasMore = events.length === PAGE_SIZE

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
        <div className="w-[200px]">
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
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

      {/* Summary */}
      {!isLoading && !error && (
        <p className="text-sm text-muted-foreground mb-4">
          {events.length === 0
            ? 'No events'
            : `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + events.length} events`}
        </p>
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
                <TableRow key={event.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedEvent(event)}>
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

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
          >
            Next →
          </Button>
        </div>
      )}

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => { if (!open) { setSelectedEvent(null); setDetailTab('details') } }}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedEvent?.title ?? 'Event Detail'}</SheetTitle>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-4 space-y-4">
              {/* Deep link to Memberry */}
              <a
                href={`${window.location.protocol}//localhost:3004/org/${selectedEvent.organizationId}/officer/events/${selectedEvent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Memberry
              </a>

              {/* Tabs */}
              <div className="flex gap-1 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailTab('details')}
                  className={`rounded-none border-b-2 -mb-px ${
                    detailTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailTab('registrations')}
                  className={`rounded-none border-b-2 -mb-px ${
                    detailTab === 'registrations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'
                  }`}
                >
                  Registrations ({selectedEvent.registrationCount ?? 0})
                </Button>
              </div>

              {detailTab === 'details' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Organization</p>
                    <p className="text-sm font-medium mt-1">{selectedEvent.organizationName ?? '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm mt-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[selectedEvent.status ?? ''] ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedEvent.status ?? 'unknown'}
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium mt-1">
                        {selectedEvent.startDate
                          ? new Date(selectedEvent.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="text-sm font-medium mt-1">
                        {selectedEvent.endDate
                          ? new Date(selectedEvent.endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '--'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registrations</p>
                    <p className="text-sm font-medium mt-1">
                      {selectedEvent.registrationCount ?? 0}
                      {selectedEvent.capacity ? ` / ${selectedEvent.capacity}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium mt-1">{selectedEvent.location ?? '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Visibility</p>
                    <p className="text-sm font-medium mt-1">{selectedEvent.isPublic ? 'Public' : 'Private'}</p>
                  </div>
                </div>
              )}

              {detailTab === 'registrations' && (
                <AdminRegistrationsTab eventId={selectedEvent.id} orgId={selectedEvent.organizationId} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )

interface AdminRegItem {
  id: string
  memberName?: string
  personName?: string
  personId?: string
  email?: string
  status: string
  createdAt: string
}

function AdminRegistrationsTab({ eventId, orgId }: { eventId: string; orgId?: string }) {
  const { data, isLoading } = useQuery(
    listCustomEventRegistrationsOptions({ path: { eventId }, ...(orgId ? { headers: { 'x-org-id': orgId } } : {}) })
  )
  const registrations = (data?.data ?? []) as unknown as AdminRegItem[]

  function exportCsv() {
    const headers = ['Name', 'Email', 'Status', 'Registered']
    const rows = registrations.map((r) => [
      r.memberName ?? r.personName ?? r.personId ?? '',
      r.email ?? '',
      r.status,
      new Date(r.createdAt).toLocaleDateString('en-PH'),
    ])
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground animate-pulse py-4">Loading registrations...</p>

  if (registrations.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No registrations</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-lg border divide-y">
        {registrations.map((reg) => (
          <div key={reg.id} className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{reg.memberName ?? reg.personName ?? reg.personId}</p>
              {reg.email && <p className="text-xs text-muted-foreground">{reg.email}</p>}
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              statusColors[reg.status] ?? 'bg-gray-100 text-gray-700'
            }`}>
              {reg.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
}
