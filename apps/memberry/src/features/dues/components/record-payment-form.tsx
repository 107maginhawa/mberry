import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { parseCentsInput } from '../lib/money'
import { FundAllocationPreview } from './fund-allocation-preview'

interface RecordPaymentFormProps {
  orgId: string
}

export function RecordPaymentForm({ orgId }: RecordPaymentFormProps) {
  const { toast } = useToast()

  const [personId, setPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: fundsData } = useQuery({
    queryKey: ['dues-funds', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`)
      return (await res.json()).data
    },
  })

  const funds = (fundsData ?? []).map((f: any) => ({
    fundId: f.name,
    percentage: parseFloat(f.percentage),
  }))

  const amountCents = parseCentsInput(amount)

  const recordMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dues/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          personId,
          amount: amountCents,
          currency: 'PHP',
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to record payment')
      return res.json()
    },
    onSuccess: () => {
      setShowConfirm(false)
      toast({ title: 'Payment recorded', description: 'Receipt sent to member.' })
      setPersonId('')
      setMemberSearch('')
      setAmount('')
      setPaymentMethod('')
      setReferenceNumber('')
    },
    onError: () => {
      toast({ title: 'Failed to record payment', description: 'Please try again.', variant: 'destructive' })
    },
  })

  const canSubmit = personId && amountCents > 0 && paymentMethod

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowConfirm(true) }}>
        <div>
          <Label>Member</Label>
          <Input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search by name or license number..."
          />
          <Input
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            placeholder="Person ID"
            className="mt-2 text-xs"
          />
        </div>

        <div>
          <Label>Amount (PHP)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>

        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="gcash">GCash</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Reference Number (optional)</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Check/bank/GCash reference"
          />
        </div>

        <Button type="submit" disabled={!canSubmit}>
          Record Payment
        </Button>
      </form>

      <div className="p-4 bg-muted/50 rounded-lg">
        {amountCents > 0 ? (
          <FundAllocationPreview amountCents={amountCents} funds={funds} />
        ) : (
          <p className="text-sm text-muted-foreground">Enter an amount to see fund allocation.</p>
        )}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Record payment of <span className="font-mono font-medium">₱{(amountCents / 100).toFixed(2)}</span> for this member?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending}>
              {recordMutation.isPending ? 'Recording...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
