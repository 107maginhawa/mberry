import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/providers')({
  component: ProvidersPage,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspended', className: 'bg-yellow-100 text-yellow-800' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-800' },
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

interface Provider {
  id: string
  name: string
  accreditationNumber: string
  status: 'active' | 'suspended' | 'expired'
  expiryDate: string | null
  expiringSoon: boolean
  organizationId: string
  createdAt: string
  updatedAt: string
}

interface ProviderFormState {
  name: string
  accreditationNumber: string
  status: string
  expiryDate: string
}

const EMPTY_FORM: ProviderFormState = {
  name: '',
  accreditationNumber: '',
  status: 'active',
  expiryDate: '',
}

function ProvidersPage() {
  const { orgId } = Route.useParams()
  const queryClient = useQueryClient()

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null)
  const [form, setForm] = useState<ProviderFormState>(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ data: Provider[]; total: number }>({
    queryKey: ['accredited-providers', orgId],
    queryFn: () => api.get(`/api/accredited-providers/${orgId}`),
  })

  const providers = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: (body: Omit<ProviderFormState, 'expiryDate'> & { expiryDate?: string }) =>
      api.post(`/api/accredited-providers/${orgId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accredited-providers', orgId] })
      toast.success('Provider created')
      setShowCreateDialog(false)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Failed to create provider'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ProviderFormState> }) =>
      api.patch(`/api/accredited-providers/${orgId}/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accredited-providers', orgId] })
      toast.success('Provider updated')
      setEditingProvider(null)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Failed to update provider'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/accredited-providers/${orgId}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accredited-providers', orgId] })
      toast.success('Provider deleted')
      setDeletingProvider(null)
    },
    onError: () => toast.error('Failed to delete provider'),
  })

  function handleCreateOpen() {
    setForm(EMPTY_FORM)
    setShowCreateDialog(true)
  }

  function handleEditOpen(p: Provider) {
    setForm({
      name: p.name,
      accreditationNumber: p.accreditationNumber,
      status: p.status,
      expiryDate: p.expiryDate ? (p.expiryDate.split('T')[0] ?? '') : '',
    })
    setEditingProvider(p)
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      name: form.name,
      accreditationNumber: form.accreditationNumber,
      status: form.status,
      ...(form.expiryDate ? { expiryDate: form.expiryDate } : {}),
    }
    if (editingProvider) {
      editMutation.mutate({ id: editingProvider.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const isSubmitting = createMutation.isPending || editMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accredited Providers"
          breadcrumbs={[
            { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
            { label: 'Settings' },
            { label: 'Providers' },
          ]}
        />
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accredited Providers"
        subtitle="Manage PRC-accredited CPD providers for your organization"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Providers' },
        ]}
        actions={
          <Button onClick={handleCreateOpen}>
            New Provider
          </Button>
        }
      />

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-[var(--color-surface-warm)]">
              <tr>
                <th className="text-left p-3 font-medium font-display">Name</th>
                <th className="text-left p-3 font-medium font-display">Accreditation #</th>
                <th className="text-left p-3 font-medium font-display">Status</th>
                <th className="text-left p-3 font-medium font-display">Expiry Date</th>
                <th className="text-right p-3 font-medium font-display">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="p-8">
                    <EmptyState
                      headline="No providers yet"
                      description="Add your first PRC-accredited CPD provider."
                    />
                  </td>
                </tr>
              ) : (
                providers.map((p) => {
                  const badge = STATUS_BADGE[p.status] ?? { label: p.status, className: 'bg-gray-100 text-gray-800' }
                  const days = daysUntil(p.expiryDate)
                  return (
                    <tr key={p.id} className="border-t hover:bg-[var(--color-surface-warm)]">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-[var(--color-muted)]">{p.accreditationNumber}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.expiryDate ? (
                            <span className="text-[var(--color-muted)]">
                              {new Date(p.expiryDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted)]">—</span>
                          )}
                          {p.expiringSoon && days !== null && (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Expiring in {days}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOpen(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingProvider(p)}
                            className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Create / Edit Dialog */}
      {(showCreateDialog || editingProvider) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-h3 mb-4">
              {editingProvider ? 'Edit Provider' : 'New Provider'}
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Provider name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Accreditation Number *</Label>
                <Input
                  type="text"
                  required
                  value={form.accreditationNumber}
                  onChange={e => setForm(f => ({ ...f, accreditationNumber: e.target.value }))}
                  placeholder="e.g. PRC-2024-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date (optional)</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowCreateDialog(false); setEditingProvider(null); setForm(EMPTY_FORM) }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingProvider ? 'Save Changes' : 'Create Provider')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-h3 mb-2">Delete Provider</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Are you sure you want to delete <strong>{deletingProvider.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingProvider(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deletingProvider.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
