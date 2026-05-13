import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMembershipCategoriesOptions,
  listMembershipCategoriesQueryKey,
  upsertMembershipCategoryMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { Layers, Plus, ToggleLeft } from 'lucide-react'

interface CategoryEditorProps {
  orgId: string
}

const BILLING_CYCLES = [
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  duesAmount: '',
  billingCycle: 'annual',
  sortOrder: '0',
}

export function CategoryEditor({ orgId }: CategoryEditorProps) {
  const queryClient = useQueryClient()

  const [showAdd, setShowAdd] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data, isLoading, error } = useQuery(
    listMembershipCategoriesOptions({ query: { organizationId: orgId } })
  )

  const categories: any[] = data?.data ?? []

  const saveMutation = useMutation({
    ...upsertMembershipCategoryMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listMembershipCategoriesQueryKey({ query: { organizationId: orgId } }),
      })
      setShowAdd(false)
      setConfirmDeactivate(null)
      setForm(EMPTY_FORM)
      toast.success('Category saved')
    },
    onError: () => {
      toast.error('Failed to save', { description: 'Please try again.' })
    },
  })

  function handleAdd() {
    if (!form.name.trim() || !form.duesAmount) return
    ;(saveMutation as any).mutate({
      path: { organizationId: orgId },
      body: {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        duesAmount: Math.round(parseFloat(form.duesAmount) * 100),
        billingCycle: form.billingCycle,
        sortOrder: parseInt(form.sortOrder) || 0,
        active: true,
      },
    })
  }

  function handleDeactivate(categoryId: string) {
    ;(saveMutation as any).mutate({ path: { organizationId: orgId }, body: { id: categoryId, active: false } })
  }

  const formValid = form.name.trim() && form.duesAmount && parseFloat(form.duesAmount) >= 0

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={() => { setForm(EMPTY_FORM); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-[var(--color-error)]">Failed to load categories.</div>
        ) : categories.length === 0 ? (
          <div className="p-14 flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <Layers className="h-10 w-10 opacity-30" />
            <p className="text-sm">No categories yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-warm)]">
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Description</th>
                  <th className="px-4 py-3 font-medium">Dues</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Cycle</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Members</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categories.map((cat: any) => (
                  <tr key={cat.id} className="hover:bg-[var(--color-surface-warm)] transition-colors">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)] max-w-xs truncate hidden sm:table-cell">
                      {cat.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {cat.duesAmount != null
                        ? `₱${(cat.duesAmount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] capitalize hidden md:table-cell">
                      {cat.billingCycle ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden md:table-cell">
                      {cat.memberCount ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {cat.active !== false ? (
                        <Badge className="bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cat.active !== false && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                          onClick={() => setConfirmDeactivate(cat.id)}
                        >
                          <ToggleLeft className="h-4 w-4 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Category dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Membership Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cat-name">Name <span className="text-[var(--color-error)]">*</span></Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Regular Member, Associate, Fellow"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description of this category"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cat-dues">Dues Amount (₱) <span className="text-[var(--color-error)]">*</span></Label>
                <Input
                  id="cat-dues"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.duesAmount}
                  onChange={(e) => setForm((f) => ({ ...f, duesAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Billing Cycle</Label>
                <Select
                  value={form.billingCycle}
                  onValueChange={(v) => setForm((f) => ({ ...f, billingCycle: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-32">
              <Label htmlFor="cat-sort">Sort Order</Label>
              <Input
                id="cat-sort"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!formValid || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation dialog */}
      <Dialog open={confirmDeactivate !== null} onOpenChange={() => setConfirmDeactivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted)]">
            Existing members in this category will not be affected, but new members cannot be assigned to it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeactivate && handleDeactivate(confirmDeactivate)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
