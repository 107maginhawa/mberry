/**
 * Special Assessments CRUD — officer-facing list + create/edit dialog.
 * Endpoints: POST/GET/PUT/DELETE /association/member/special-assessments
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCents } from '@/features/dues/lib/money'
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Textarea, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@monobase/ui'
import { Plus, Pencil, Trash2, Play, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { extractErrorMessage } from '@/utils/error'
import { StatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'

interface SpecialAssessment {
  id: string
  name: string
  description: string | null
  amount: number
  currency: string
  dueDate: string
  fundId: string | null
  appliesTo: 'all' | 'selected'
  status: 'draft' | 'active' | 'closed'
  createdAt: string
  collection?: {
    totalTargets: number
    paidCount: number
    pendingCount: number
    totalCollected: number
    totalExpected: number
  }
}

interface FormData {
  name: string
  description: string
  amount: string
  currency: string
  dueDate: string
  appliesTo: 'all' | 'selected'
}

const emptyForm: FormData = {
  name: '',
  description: '',
  amount: '',
  currency: 'PHP',
  dueDate: '',
  appliesTo: 'all',
}

interface SpecialAssessmentsListProps {
  orgId: string
}

export function SpecialAssessmentsList({ orgId }: SpecialAssessmentsListProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [collectionDialogId, setCollectionDialogId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['special-assessments', orgId],
    queryFn: () =>
      api.get<{ assessments: SpecialAssessment[] }>(
        `/api/association/member/special-assessments/${orgId}`,
      ),
    enabled: !!orgId,
  })

  const assessments = data?.assessments ?? []

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/api/association/member/special-assessments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-assessments', orgId] })
      toast.success('Assessment created')
      closeDialog()
    },
    onError: (err) => toast.error('Failed to create assessment', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/api/association/member/special-assessments/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-assessments', orgId] })
      toast.success('Assessment updated')
      closeDialog()
    },
    onError: (err) => toast.error('Failed to update assessment', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/association/member/special-assessments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-assessments', orgId] })
      toast.success('Assessment deleted')
    },
    onError: (err) => toast.error('Failed to delete assessment', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  const applyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/association/member/special-assessments/${id}/apply`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-assessments', orgId] })
      toast.success('Assessment applied — invoices generated')
    },
    onError: (err) => toast.error('Failed to apply assessment', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function openCreate() {
    setForm(emptyForm)
    setEditingId(null)
    setDialogOpen(true)
  }

  function openEdit(a: SpecialAssessment) {
    setForm({
      name: a.name,
      description: a.description ?? '',
      amount: String(a.amount),
      currency: a.currency,
      dueDate: a.dueDate,
      appliesTo: a.appliesTo,
    })
    setEditingId(a.id)
    setDialogOpen(true)
  }

  function handleSubmit() {
    const amountCents = Math.round(Number(form.amount))
    if (!form.name || !amountCents || !form.dueDate) {
      toast.error('Name, amount, and due date are required')
      return
    }

    const body = {
      name: form.name,
      description: form.description || undefined,
      amount: amountCents,
      currency: form.currency,
      dueDate: form.dueDate,
      appliesTo: form.appliesTo,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const statusVariant: Record<string, StatusBadgeVariant> = {
    draft: 'warning',
    active: 'success',
    closed: 'muted',
  }

  // Find current collection dialog assessment
  const collectionAssessment = assessments.find(a => a.id === collectionDialogId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Special Assessments</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader><CardTitle>Special Assessments</CardTitle></CardHeader>
        <CardContent>
          <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
            Unable to load special assessments. Please try refreshing the page.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Special Assessments</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> New Assessment
          </Button>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No special assessments yet. Create one to charge members a one-time fee.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{formatCents(a.amount, a.currency)}</TableCell>
                    <TableCell>{a.dueDate}</TableCell>
                    <TableCell className="capitalize">{a.appliesTo}</TableCell>
                    <TableCell>
                      <StatusBadge variant={statusVariant[a.status] ?? 'muted'}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {a.collection ? (
                        <Button
                          variant="link"
                          onClick={() => setCollectionDialogId(a.id)}
                          className="h-auto p-0 text-sm text-[var(--color-info)] hover:underline"
                        >
                          {a.collection.paidCount}/{a.collection.totalTargets} paid
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {a.status === 'draft' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Edit" aria-label="Edit assessment">
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Apply this assessment? Invoices will be generated for all targeted members.')) {
                                applyMutation.mutate(a.id)
                              }
                            }}
                            title="Apply"
                            aria-label="Apply assessment"
                          >
                            <Play size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Delete this draft assessment?')) {
                                deleteMutation.mutate(a.id)
                              }
                            }}
                            title="Delete"
                            aria-label="Delete draft assessment"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                      {a.status === 'active' && a.collection && (
                        <Button size="icon" variant="ghost" onClick={() => setCollectionDialogId(a.id)} title="View Collection" aria-label="View collection">
                          <Eye size={14} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Assessment' : 'New Special Assessment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="sa-name">Name</Label>
              <Input
                id="sa-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Building Fund Contribution"
              />
            </div>
            <div>
              <Label htmlFor="sa-desc">Description (optional)</Label>
              <Textarea
                id="sa-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Purpose of this assessment..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sa-amount">Amount (centavos)</Label>
                <Input
                  id="sa-amount"
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="50000"
                />
                {form.amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    = {formatCents(Number(form.amount), form.currency)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="sa-due">Due Date</Label>
                <Input
                  id="sa-due"
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sa-applies">Applies To</Label>
              <Select value={form.appliesTo} onValueChange={v => setForm(f => ({ ...f, appliesTo: v as 'all' | 'selected' }))}>
                <SelectTrigger id="sa-applies">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="selected">Selected Members</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Update' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Details Dialog */}
      <Dialog open={!!collectionDialogId} onOpenChange={v => { if (!v) setCollectionDialogId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collection Details — {collectionAssessment?.name}</DialogTitle>
          </DialogHeader>
          {collectionAssessment?.collection && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-muted-foreground">Total Targets</p>
                  <p className="text-lg font-bold">{collectionAssessment.collection.totalTargets}</p>
                </div>
                <div className="bg-[var(--color-success-bg)] rounded-lg p-3">
                  <p className="text-muted-foreground">Paid</p>
                  <p className="text-lg font-bold text-[var(--color-success)]">{collectionAssessment.collection.paidCount}</p>
                </div>
                <div className="bg-[var(--color-warning-bg)] rounded-lg p-3">
                  <p className="text-muted-foreground">Pending</p>
                  <p className="text-lg font-bold text-[var(--color-warning)]">{collectionAssessment.collection.pendingCount}</p>
                </div>
                <div className="bg-[var(--color-info-bg)] rounded-lg p-3">
                  <p className="text-muted-foreground">Collected</p>
                  <p className="text-lg font-bold text-[var(--color-info)]">
                    {formatCents(collectionAssessment.collection.totalCollected, collectionAssessment.currency)}
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Expected: {formatCents(collectionAssessment.collection.totalExpected, collectionAssessment.currency)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
