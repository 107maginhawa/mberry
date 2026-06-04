import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSeatAllocationsOptions,
  listSeatAllocationsQueryKey,
  getInstitutionalMembershipQueryKey,
  allocateSeatMutation,
  revokeSeatMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Users } from 'lucide-react'

interface SeatManagementPanelProps {
  institutionalMembershipId: string
  orgId: string
  totalSeats: number
  usedSeats: number
}

export function SeatManagementPanel({
  institutionalMembershipId,
  orgId,
  totalSeats,
  usedSeats,
}: SeatManagementPanelProps) {
  const queryClient = useQueryClient()
  const [showAllocate, setShowAllocate] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [personIdInput, setPersonIdInput] = useState('')
  const [isAllocating, setIsAllocating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const { data, isLoading, error } = useQuery(
    listSeatAllocationsOptions({
      path: { institutionalMembershipId },
      query: { limit: 50 },
      headers: { 'x-org-id': orgId },
    })
  )

  const seats = data?.data ?? []

  function invalidateAll() {
    queryClient.invalidateQueries({
      queryKey: listSeatAllocationsQueryKey({ path: { institutionalMembershipId }, query: { limit: 50 } }),
    })
    queryClient.invalidateQueries({
      queryKey: getInstitutionalMembershipQueryKey({ path: { institutionalMembershipId } }),
    })
  }

  const allocateMutOpts = allocateSeatMutation()
  const allocateMut = useMutation({
    mutationFn: allocateMutOpts.mutationFn,
    onSuccess: () => {
      toast.success('Seat allocated')
      invalidateAll()
      setShowAllocate(false)
      setPersonIdInput('')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to allocate seat'),
  })

  const revokeMutOpts = revokeSeatMutation()
  const revokeMut = useMutation({
    mutationFn: revokeMutOpts.mutationFn,
    onSuccess: () => {
      toast.success('Seat revoked')
      invalidateAll()
      setRevokeId(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to revoke seat'),
  })

  async function handleAllocate() {
    if (!personIdInput.trim()) {
      toast.error('Person ID is required')
      return
    }
    setIsAllocating(true)
    try {
      await allocateMut.mutateAsync({
        path: { institutionalMembershipId },
        body: { personId: personIdInput.trim() },
      })
    } finally {
      setIsAllocating(false)
    }
  }

  async function handleRevoke(seatAllocationId: string) {
    setIsRevoking(true)
    try {
      await revokeMut.mutateAsync({
        path: { institutionalMembershipId, seatAllocationId },
      })
    } finally {
      setIsRevoking(false)
    }
  }

  const capacityPct = totalSeats > 0 ? Math.min((usedSeats / totalSeats) * 100, 100) : 0

  return (
    <div className="space-y-4">
      {/* Capacity bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--color-text)]">Seat Capacity</span>
          <span className="text-[var(--color-muted)]">{usedSeats} / {totalSeats} used</span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--color-surface-warm)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              capacityPct >= 90
                ? 'bg-[var(--color-error)]'
                : capacityPct >= 70
                ? 'bg-[var(--color-warning)]'
                : 'bg-[var(--color-success)]'
            }`}
            style={{ width: `${capacityPct}%` }}
          />
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Seat Allocations</h3>
        <Button
          size="sm"
          onClick={() => setShowAllocate(true)}
          disabled={usedSeats >= totalSeats}
        >
          Allocate Seat
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" aria-live="polite" className="p-8 text-center text-[var(--color-error)] text-sm">
            Failed to load seat allocations.
          </div>
        ) : seats.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-[var(--color-muted)]">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">No seats allocated yet.</p>
          </div>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-warm)]">
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Person ID</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Allocated At</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {seats.map((seat) => (
                <TableRow key={seat.id} className="hover:bg-[var(--color-surface-warm)] transition-colors">
                  <TableCell className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={seat.personId}>
                    {seat.personId}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-body-sm text-[var(--color-muted)]">
                    {new Date(seat.allocatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {seat.status === 'active' ? (
                      <Badge className="bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">Revoked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {seat.status === 'active' && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setRevokeId(seat.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Allocate Seat dialog */}
      <Dialog open={showAllocate} onOpenChange={(open) => { if (!open) { setShowAllocate(false); setPersonIdInput('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Seat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="allocate-person-id">Person ID</Label>
              <Input
                id="allocate-person-id"
                placeholder="UUID of the person"
                value={personIdInput}
                onChange={(e) => setPersonIdInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowAllocate(false); setPersonIdInput('') }} disabled={isAllocating}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAllocate} disabled={isAllocating || !personIdInput.trim()}>
              {isAllocating ? 'Allocating...' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeId} onOpenChange={(open) => { if (!open) setRevokeId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Seat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted)] py-2">
            Are you sure you want to revoke this seat allocation? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRevokeId(null)} disabled={isRevoking}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => revokeId && handleRevoke(revokeId)}
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Revoke Seat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
