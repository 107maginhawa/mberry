import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Label } from '@monobase/ui'
import { toast } from 'sonner'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  getAssociationOptions,
  getAssociationQueryKey,
  listAssociationsQueryKey,
  updateAssociationMutation,
  deleteAssociationMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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

function AssociationDetailPage() {
  const { associationId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editCurrency, setEditCurrency] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  const startEdit = () => {
    if (association) {
      setEditName(association.name)
      setEditCountry(association.country)
      setEditCurrency(association.currency)
      setEditing(true)
    }
  }

  const createdDate = association?.createdAt || association?.created_at

  return (
    <div className="p-8">
      <Link
        to="/associations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Associations
      </Link>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load association'}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !association ? (
        <div className="text-muted-foreground">Association not found.</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-muted-foreground" />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {association.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  ID: {associationId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit Association
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {/* Edit Dialog */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(false)}>
              <div className="bg-card border rounded-lg p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Edit Association</h2>
                  <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
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
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">Country (2-letter code)</Label>
                    <input
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
                    <input
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
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateMut.isPending}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {updateMut.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}>
              <div className="bg-card border rounded-lg p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-2">Delete Association</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to delete <strong>{association.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMut.mutate({ path: { associationId } })}
                    disabled={deleteMut.isPending}
                    className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteMut.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detail Card */}
          <div className="rounded-lg border bg-card p-6 mb-8">
            <h2 className="text-lg font-medium mb-4">Details</h2>
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
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm font-medium mt-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    association.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : association.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {association.status ?? 'unknown'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium mt-1">
                  {createdDate ? new Date(createdDate).toLocaleDateString() : '--'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-sm font-medium mt-1">{association.memberCount ?? '--'}</p>
              </div>
            </div>
          </div>

          {/* Organizations within this association */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Organizations</h2>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-accent transition-colors">
              <Plus className="w-4 h-4" />
              Add Organization
            </button>
          </div>

          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No organizations found for this association.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
