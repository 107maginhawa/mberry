import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, Trash2, X, Users, TrendingUp, GraduationCap, Calendar, BarChart3 } from 'lucide-react'
import { Button, Input, Label, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { toast } from 'sonner'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  getAssociationOptions,
  getAssociationQueryKey,
  listAssociationsQueryKey,
  updateAssociationMutation,
  deleteAssociationMutation,
  listOrganizationsOptions,
  listOrganizationsQueryKey,
  createOrganizationMutation,
  searchEventsOptions,
  searchCoursesOptions,
} from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/associations/$associationId')({
  component: AssociationDetailPage,
})

interface Association {
  id: string
  name: string
  country: string
  currency: string
  status?: string
  memberCount?: number
  createdAt?: string
  created_at?: string
}

interface Organization {
  id: string
  name: string
  type?: string
  status?: string
  memberCount?: number
}

interface NationalDashboardAggregate {
  chapterCount: number
  totalMembers: number
  collectionRate: number
  cpdComplianceRate: number
  totalActivityCount90d: number
}

interface NationalDashboardResponse {
  data: {
    associationId: string
    snapshotMonth: string
    aggregate: NationalDashboardAggregate
  }
}

function AssociationDetailPage() {
  const { associationId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editCurrency, setEditCurrency] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingOrg, setAddingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgType, setNewOrgType] = useState('')

  const { data: sdkAssociation, isLoading, error } = useQuery(
    getAssociationOptions({ path: { associationId } })
  )
  // Cast to local Association interface which includes extended fields (status, memberCount, created_at)
  const association = sdkAssociation as unknown as Association | undefined

  const sdkUpdateAssociation = updateAssociationMutation()
  const updateMut = useMutation({
    mutationFn: sdkUpdateAssociation.mutationFn,
    onSuccess: () => {
      toast.success('Association updated')
      queryClient.invalidateQueries({ queryKey: getAssociationQueryKey({ path: { associationId } }) })
      setEditing(false)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update association'
      toast.error(msg)
    },
  })

  const sdkDeleteAssociation = deleteAssociationMutation()
  const deleteMut = useMutation({
    mutationFn: sdkDeleteAssociation.mutationFn,
    onSuccess: () => {
      toast.success('Association deleted')
      queryClient.invalidateQueries({ queryKey: listAssociationsQueryKey() })
      navigate({ to: '/associations' })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete association'
      toast.error(msg)
    },
  })

  const sdkCreateOrganization = createOrganizationMutation()
  const createOrgMut = useMutation({
    mutationFn: sdkCreateOrganization.mutationFn,
    onSuccess: () => {
      toast.success('Organization created')
      queryClient.invalidateQueries({ queryKey: listOrganizationsQueryKey({ query: { associationId } }) })
      setAddingOrg(false)
      setNewOrgName('')
      setNewOrgType('')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create organization'
      toast.error(msg)
    },
  })

  // Fetch organizations for this association
  const { data: orgsData, isLoading: orgsLoading } = useQuery(
    listOrganizationsOptions({ query: { associationId, limit: 100 } })
  )
  const orgs = (orgsData?.data ?? []) as Organization[]

  // Fetch national dashboard data for chapter health KPIs
  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data: dashboardData, isLoading: dashLoading } = useQuery<NationalDashboardResponse>({
    queryKey: ['national-dashboard', associationId, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/admin/national-dashboard/${associationId}?snapshotMonth=${currentMonth}`)
      if (!res.ok) throw new Error(`Failed to load dashboard: ${res.statusText}`)
      return res.json()
    },
    enabled: !!associationId,
  })
  const aggregate = dashboardData?.data?.aggregate

  // Fetch recent events for this association's orgs
  const { data: recentEventsData } = useQuery(
    searchEventsOptions({ query: { limit: 5 } })
  )
  const recentEvents = (recentEventsData?.data ?? []) as unknown as Array<{
    id: string; title: string; startDate?: string; status?: string; organizationName?: string
  }>

  // Fetch recent training for this association's orgs
  const { data: recentCoursesData } = useQuery(
    searchCoursesOptions({ query: { limit: 5 } })
  )
  const recentCourses = (recentCoursesData?.data ?? []) as unknown as Array<{
    id: string; title?: string; name?: string; startDate?: string; createdAt?: string; status?: string; organizationName?: string
  }>

  // Merge and sort recent activity
  const recentActivity = [
    ...recentEvents.map((e) => ({ type: 'event' as const, title: e.title, date: e.startDate, status: e.status, org: e.organizationName })),
    ...recentCourses.map((c) => ({ type: 'training' as const, title: c.title || c.name || 'Untitled', date: c.startDate || c.createdAt, status: c.status, org: c.organizationName })),
  ]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 10)

  const startEdit = () => {
    if (association) {
      setEditName(association.name)
      setEditCountry(association.country)
      setEditCurrency(association.currency)
      setEditing(true)
    }
  }

  const createdDate = association?.createdAt || association?.created_at

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <PageShell
      title={association?.name ?? 'Association'}
      breadcrumbs={[
        { label: 'Associations', href: '/associations' },
        { label: association?.name ?? associationId },
      ]}
      maxWidth="full"
      subtitle={
        association ? (
          <>
            ID: {associationId}
            {association.status && (
              <span
                className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  association.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : association.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {association.status}
              </span>
            )}
            {createdDate && (
              <span className="ml-3">
                Since {new Date(createdDate).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
              </span>
            )}
          </>
        ) : undefined
      }
      actions={
        association ? (
          <>
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="w-4 h-4" />
              Edit Association
            </Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </>
        ) : undefined
      }
    >
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load association'}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <div className="h-6 w-[40%] rounded bg-muted animate-pulse" />
            <div className="h-4 w-[25%] rounded bg-muted animate-pulse" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="h-3 w-[50%] rounded bg-muted animate-pulse" />
                <div className="h-8 w-[30%] rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : !association ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Association not found.</p>
        </div>
      ) : (
        <>
          {/* Chapter Health KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
              {dashLoading ? (
                <p className="text-2xl font-bold text-muted-foreground animate-pulse">...</p>
              ) : (
                <p className="text-2xl font-bold">{aggregate?.totalMembers?.toLocaleString() ?? '--'}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{aggregate?.chapterCount ?? '--'} chapters</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Collection Rate</p>
              </div>
              {dashLoading ? (
                <p className="text-2xl font-bold text-muted-foreground animate-pulse">...</p>
              ) : (
                <p className="text-2xl font-bold">{aggregate ? formatPercent(aggregate.collectionRate) : '--'}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">this month</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">CPD Compliance</p>
              </div>
              {dashLoading ? (
                <p className="text-2xl font-bold text-muted-foreground animate-pulse">...</p>
              ) : (
                <p className="text-2xl font-bold">{aggregate ? formatPercent(aggregate.cpdComplianceRate) : '--'}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">compliant</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Activity (90d)</p>
              </div>
              {dashLoading ? (
                <p className="text-2xl font-bold text-muted-foreground animate-pulse">...</p>
              ) : (
                <p className="text-2xl font-bold">{aggregate?.totalActivityCount90d ?? '--'}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">events + training</p>
            </div>
          </div>

          {/* Link to National Dashboard */}
          <Link
            to="/national-dashboard"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-8"
          >
            <BarChart3 className="w-4 h-4" />
            View National Dashboard →
          </Link>

          {/* Edit Dialog */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(false)}>
              <div className="bg-card border rounded-lg p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-h2">Edit Association</h2>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Close">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    updateMut.mutate({ path: { associationId }, body: { name: editName, country: editCountry, currency: editCurrency } })
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="block text-sm font-medium mb-1">Name</Label>
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">Country (2-letter code)</Label>
                    <Input
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value.toUpperCase())}
                      required
                      maxLength={2}
                      pattern="[A-Z]{2}"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">Currency (3-letter code)</Label>
                    <Input
                      type="text"
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                      required
                      maxLength={3}
                      pattern="[A-Z]{3}"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateMut.isPending}>
                      {updateMut.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}>
              <div className="bg-card border rounded-lg p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-h2 mb-2">Delete Association</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to delete <strong>{association.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMut.mutate({ path: { associationId } })}
                    disabled={deleteMut.isPending}
                  >
                    {deleteMut.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Organization Dialog */}
          {addingOrg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddingOrg(false)}>
              <div className="bg-card border rounded-lg p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-h2">Add Organization</h2>
                  <Button variant="ghost" size="icon" onClick={() => setAddingOrg(false)} aria-label="Close">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    createOrgMut.mutate({ body: { associationId, name: newOrgName, type: newOrgType || undefined } as any })
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="block text-sm font-medium mb-1">Name</Label>
                    <Input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      required
                      placeholder="Chapter name"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">Type (optional)</Label>
                    <Input
                      type="text"
                      value={newOrgType}
                      onChange={(e) => setNewOrgType(e.target.value)}
                      placeholder="e.g. chapter, branch"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAddingOrg(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createOrgMut.isPending}>
                      {createOrgMut.isPending ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Detail Card */}
          <div className="rounded-lg border bg-card p-6 mb-8">
            <h2 className="text-h2 mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-sm font-medium mt-1">{association.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <p className="text-sm font-medium mt-1">{association.country}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Currency</p>
                <p className="text-sm font-medium mt-1">{association.currency}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium mt-1">
                  {createdDate ? new Date(createdDate).toLocaleDateString() : '--'}
                </p>
              </div>
            </div>
          </div>

          {/* Organizations within this association */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2">Organizations ({orgs.length})</h2>
            <Button variant="outline" size="sm" onClick={() => setAddingOrg(true)}>
              <Plus className="w-4 h-4" />
              Add Organization
            </Button>
          </div>

          <div className="rounded-lg border bg-card mb-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-4 text-sm">Name</TableHead>
                  <TableHead className="p-4 text-sm">Type</TableHead>
                  <TableHead className="p-4 text-sm">Status</TableHead>
                  <TableHead className="p-4 text-sm">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-8 text-center text-muted-foreground animate-pulse">
                      Loading organizations...
                    </TableCell>
                  </TableRow>
                ) : orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>No organizations found for this association.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="p-4 text-sm font-medium">
                        <Link to="/organizations/$organizationId" params={{ organizationId: org.id }} className="hover:underline text-primary">
                          {org.name}
                        </Link>
                      </TableCell>
                      <TableCell className="p-4 text-sm text-muted-foreground">{org.type ?? '--'}</TableCell>
                      <TableCell className="p-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          org.status === 'active' ? 'bg-green-100 text-green-700'
                            : org.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {org.status ?? 'unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4 text-sm text-muted-foreground">{org.memberCount ?? '--'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Recent Activity */}
          <div className="mb-8">
            <h2 className="text-h2 mb-4">Recent Activity</h2>
            <div className="rounded-lg border bg-card divide-y">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No recent events or training found.</p>
                </div>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    {item.type === 'event' ? (
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="text-xs uppercase text-muted-foreground mr-2">{item.type}</span>
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.date ? new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                        {item.org && <span className="ml-2">· {item.org}</span>}
                        {item.status && (
                          <span className={`ml-2 ${
                            item.status === 'published' || item.status === 'completed' ? 'text-green-600'
                              : item.status === 'cancelled' ? 'text-red-600'
                              : 'text-muted-foreground'
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  )
}
