import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, X } from 'lucide-react'
import { Button, Input, Label, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  listAssociationsOptions,
  listAssociationsQueryKey,
  createAssociationMutation,
} from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/associations/')({
  component: AssociationsPage,
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


function CreateAssociationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')

  const sdkCreateAssociation = createAssociationMutation()
  const createMutation = useMutation({
    mutationFn: sdkCreateAssociation.mutationFn,
    onSuccess: () => {
      toast.success('Association created')
      queryClient.invalidateQueries({ queryKey: listAssociationsQueryKey() })
      setName('')
      setCountry('')
      setCurrency('')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create association'
      toast.error(msg)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-lg p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2">Create Association</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate({ body: { name, country, currency } })
          }}
          className="space-y-4"
        >
          <div>
            <Label className="block text-sm font-medium mb-1">Name</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              placeholder="Association name"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">Country (2-letter code)</Label>
            <Input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              required
              maxLength={2}
              pattern="[A-Z]{2}"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              placeholder="PH"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">Currency (3-letter code)</Label>
            <Input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              required
              maxLength={3}
              pattern="[A-Z]{3}"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              placeholder="PHP"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssociationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, error } = useQuery(listAssociationsOptions({ query: { limit: 50 } }))

  // Cast to local Association interface which includes extended fields (status, memberCount, created_at)
  const associations = (data?.data ?? []) as unknown as Association[]
  const total = data?.pagination?.totalCount ?? associations.length
  const activeCount = associations.filter((a) => a.status === 'active').length
  const pendingCount = associations.filter((a) => a.status === 'pending').length

  return (
    <PageShell
      title="Associations"
      subtitle="Manage healthcare associations across the platform"
      maxWidth="full"
      actions={
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Association
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Associations</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : total}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : activeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : pendingCount}</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load associations'}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Name</TableHead>
              <TableHead className="p-4 text-sm">Country</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
              <TableHead className="p-4 text-sm">Members</TableHead>
              <TableHead className="p-4 text-sm">Created</TableHead>
              <TableHead className="text-right p-4 text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading associations...
                </TableCell>
              </TableRow>
            ) : associations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No associations found.</p>
                  <p className="text-xs mt-1">Create one to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              associations.map((assoc) => (
                <TableRow key={assoc.id}>
                  <TableCell className="p-4 text-sm font-medium">
                    <Link
                      to="/associations/$associationId"
                      params={{ associationId: assoc.id }}
                      className="text-foreground hover:underline"
                    >
                      {assoc.name}
                    </Link>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">{assoc.country}</TableCell>
                  <TableCell className="p-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      assoc.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : assoc.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {assoc.status ?? 'unknown'}
                    </span>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">{assoc.memberCount ?? '--'}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {(assoc.createdAt || assoc.created_at)
                      ? new Date(assoc.createdAt || assoc.created_at!).toLocaleDateString()
                      : '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">
                    <Link
                      to="/associations/$associationId"
                      params={{ associationId: assoc.id }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateAssociationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </PageShell>
  )
}
