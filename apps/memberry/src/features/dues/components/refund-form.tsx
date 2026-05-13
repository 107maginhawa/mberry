import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  refundDuesPaymentMutation,
  getDuesPaymentQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { formatCents, parseCentsInput } from '../lib/money'

interface RefundFormProps {
  paymentId: string
  maxAmount: number
  currency: string
}

export function RefundForm({ paymentId, maxAmount, currency }: RefundFormProps) {
  const queryClient = useQueryClient()

  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState((maxAmount / 100).toFixed(2))
  const [reason, setReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const amountCents = parseCentsInput(amount)
  const amountError = amountCents > maxAmount
    ? `Refund cannot exceed ${formatCents(maxAmount, currency)}`
    : null

  const refundMutation = useMutation({
    ...refundDuesPaymentMutation(),
    onSuccess: () => {
      setShowConfirm(false)
      setExpanded(false)
      queryClient.invalidateQueries({ queryKey: getDuesPaymentQueryKey({ path: { paymentId } }) })
      toast.success(`Refund of ${formatCents(amountCents, currency)} processed.`)
    },
    onError: () => {
      toast.error('Refund failed', { description: 'Please try again.' })
    },
  })

  if (!expanded) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setExpanded(true)}>
        Refund
      </Button>
    )
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <h4 className="text-sm font-medium">Initiate Refund</h4>
      <div>
        <Label>Amount ({currency})</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {amountError && <p className="text-xs text-[var(--color-error)] mt-1">{amountError}</p>}
      </div>
      <div>
        <Label>Reason (required)</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for refund..."
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={!reason || amountCents <= 0 || !!amountError}
          onClick={() => setShowConfirm(true)}
        >
          Initiate Refund
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>Cancel</Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Refund</DialogTitle></DialogHeader>
          <p className="text-sm">
            Refund {formatCents(amountCents, currency)}? Fund allocations will be reversed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => (refundMutation as any).mutate({ path: { paymentId }, body: { amount: amountCents, reason } })} disabled={refundMutation.isPending}>
              {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
