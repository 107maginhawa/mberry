import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

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

interface AssociationsResponse {
  data: Association[]
  total?: number
}

function CreateAssociationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/associations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, country, currency }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to create association')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Association created')
      queryClient.invalidateQueries({ queryKey: ['admin', 'associations'] })
      setName('')
      setCountry('')
      setCurrency('')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-lg p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Association</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              placeholder="Association name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country (2-letter code)</label>
            <input
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
            <label className="block text-sm font-medium mb-1">Currency (3-letter code)</label>
            <input
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssociationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, error } = useQuery<AssociationsResponse>({
    queryKey: ['admin', 'associations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/associations?limit=50', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch associations')
      return res.json()
    },
  })

  const associations = data?.data ?? []
  const total = data?.total ?? associations.length
  const activeCount = associations.filter((a) => a.status === 'active').length
  const pendingCount = associations.filter((a) => a.status === 'pending').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Associations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage healthcare associations across the platform
            </p>
          </div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Association
        </button>
      </div>

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
          {error.message}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Country</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Created</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : associations.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No associations found.
                </td>
              </tr>
            ) : (
              associations.map((assoc) => (
                <tr key={assoc.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="p-4 text-sm font-medium">
                    <Link
                      to="/associations/$associationId"
                      params={{ associationId: assoc.id }}
                      className="text-foreground hover:underline"
                    >
                      {assoc.name}
                    </Link>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{assoc.country}</td>
                  <td className="p-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      assoc.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : assoc.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {assoc.status ?? 'unknown'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{assoc.memberCount ?? '--'}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {(assoc.createdAt || assoc.created_at)
                      ? new Date(assoc.createdAt || assoc.created_at!).toLocaleDateString()
                      : '--'}
                  </td>
                  <td className="p-4 text-sm text-right">
                    <Link
                      to="/associations/$associationId"
                      params={{ associationId: assoc.id }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateAssociationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
