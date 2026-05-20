import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
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

const providerSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  accreditationNumber: z.string().min(1, 'Accreditation number is required'),
  status: z.enum(['active', 'suspended', 'expired']).default('active'),
  expiryDate: z.string().optional(),
})

type ProviderFormData = z.infer<typeof providerSchema>

function ProvidersPage() {
  const { orgId } = Route.useParams()
  const queryClient = useQueryClient()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null)

  const { data, isLoading } = useQuery<{ data: Provider[]; total: number }>({
    queryKey: ['accredited-providers', orgId],
    queryFn: () => api.get(`/api/accredited-providers/${orgId}`),
  })

  const providers = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: (body: ProviderFormData) =>
      api.post(`/api/accredited-providers/${orgId}`, {
        ...body,
        expiryDate: body.expiryDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accredited-providers', orgId] })
      toast.success('Provider created')
      setShowCreateDialog(false)
    },
    onError: () => toast.error('Failed to create provider'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProviderFormData }) =>
      api.patch(`/api/accredited-providers/${orgId}/${id}`, {
        ...body,
        expiryDate: body.expiryDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accredited-providers', orgId] })
      toast.success('Provider updated')
      setEditingProvider(null)
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
          <Button onClick={() => setShowCreateDialog(true)}>
            New Provider
          </Button>
        }
      />

      <GlassCard>
        <Table className="text-[14px]">
          <TableHeader className="bg-[var(--color-surface-warm)]">
            <TableRow>
              <TableHead className="p-3 font-display">Name</TableHead>
              <TableHead className="p-3 font-display">Accreditation #</TableHead>
              <TableHead className="p-3 font-display">Status</TableHead>
              <TableHead className="p-3 font-display">Expiry Date</TableHead>
              <TableHead className="p-3 text-right font-display">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow className="border-t">
                <TableCell colSpan={5} className="p-8">
                  <EmptyState
                    headline="No providers yet"
                    description="Add your first PRC-accredited CPD provider."
                  />
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => {
                const badge = STATUS_BADGE[p.status] ?? { label: p.status, className: 'bg-gray-100 text-gray-800' }
                const days = daysUntil(p.expiryDate)
                return (
                  <TableRow key={p.id} className="border-t hover:bg-[var(--color-surface-warm)]">
                    <TableCell className="p-3 font-medium">{p.name}</TableCell>
                    <TableCell className="p-3 text-[var(--color-muted)]">{p.accreditationNumber}</TableCell>
                    <TableCell className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="p-3">
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
                    </TableCell>
                    <TableCell className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProvider(p)}
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
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Create / Edit Dialog */}
      {(showCreateDialog || editingProvider) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-h3 mb-4">
              {editingProvider ? 'Edit Provider' : 'New Provider'}
            </h2>
            <ProviderForm
              key={editingProvider?.id ?? 'new'}
              defaultValues={
                editingProvider
                  ? {
                      name: editingProvider.name,
                      accreditationNumber: editingProvider.accreditationNumber,
                      status: editingProvider.status,
                      expiryDate: editingProvider.expiryDate ? (editingProvider.expiryDate.split('T')[0] ?? '') : '',
                    }
                  : { name: '', accreditationNumber: '', status: 'active', expiryDate: '' }
              }
              isSubmitting={isSubmitting}
              onSubmit={(data) => {
                if (editingProvider) {
                  editMutation.mutate({ id: editingProvider.id, body: data })
                } else {
                  createMutation.mutate(data)
                }
              }}
              onCancel={() => { setShowCreateDialog(false); setEditingProvider(null) }}
              submitLabel={editingProvider ? 'Save Changes' : 'Create Provider'}
            />
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

function ProviderForm({
  defaultValues,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues: ProviderFormData
  isSubmitting: boolean
  onSubmit: (data: ProviderFormData) => void
  onCancel: () => void
  submitLabel: string
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          type="text"
          placeholder="Provider name"
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accreditationNumber">Accreditation Number *</Label>
        <Input
          id="accreditationNumber"
          type="text"
          placeholder="e.g. PRC-2024-001"
          aria-describedby={errors.accreditationNumber ? 'accreditationNumber-error' : undefined}
          {...register('accreditationNumber')}
        />
        {errors.accreditationNumber && (
          <p id="accreditationNumber-error" role="alert" className="text-xs text-[var(--color-error)]">
            {errors.accreditationNumber.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expiryDate">Expiry Date (optional)</Label>
        <Input
          id="expiryDate"
          type="date"
          {...register('expiryDate')}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
