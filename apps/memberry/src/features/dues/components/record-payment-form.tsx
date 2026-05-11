import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  listDuesFundsOptions,
  listRosterMembersOptions,
  recordDuesPaymentMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { parseCentsInput } from '../lib/money'
import { FundAllocationPreview } from './fund-allocation-preview'

interface RecordPaymentFormProps {
  orgId: string
}

export function RecordPaymentForm({ orgId }: RecordPaymentFormProps) {
  const [personId, setPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: fundsData } = useQuery(listDuesFundsOptions({ query: { organizationId: orgId } }))

  const funds = (fundsData?.data ?? []).map((f: any) => ({
    fundId: f.name,
    percentage: parseFloat(f.percentage),
  }))

  const amountCents = parseCentsInput(amount)

  const recordMutation = useMutation({
    ...recordDuesPaymentMutation(),
    onSuccess: () => {
      setShowConfirm(false)
      toast.success('Payment recorded', { description: 'Receipt sent to member.' })
      setPersonId('')
      setMemberSearch('')
      setAmount('')
      setPaymentMethod('')
      setReferenceNumber('')
    },
    onError: () => {
      toast.error('Failed to record payment', { description: 'Please try again.' })
    },
  })

  // Debounce the search input before querying
  useEffect(() => {
    if (!memberSearch.trim() || memberSearch.trim().length < 2 || personId) {
      setDebouncedSearch('')
      return
    }
    const timer = setTimeout(() => setDebouncedSearch(memberSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [memberSearch, personId])

  // SDK-based member search
  const { data: memberSearchData, isFetching: searchingMembers } = useQuery({
    ...listRosterMembersOptions({
      query: {
        q: debouncedSearch,
        limit: 10,
        organizationId: orgId,
      },
    }),
    enabled: debouncedSearch.length >= 2,
  })

  const memberResults = memberSearchData?.data ?? []

  function selectMember(m: { personId: string; memberNumber?: string; id: string }) {
    setPersonId(m.personId || m.id)
    setMemberSearch(m.memberNumber || m.personId)
    setDebouncedSearch('')
  }

  const canSubmit = personId && amountCents > 0 && paymentMethod

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowConfirm(true) }}>
        <div className="relative">
          <Label>Member</Label>
          <Input
            value={memberSearch}
            onChange={(e) => { setMemberSearch(e.target.value); setPersonId('') }}
            placeholder="Search by name or license number..."
          />
          {searchingMembers && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
          {memberResults.length > 0 && !personId && (
            <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-white relative z-50 shadow-lg">
              {memberResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => selectMember(m)}
                >
                  <span className="font-medium">{m.memberNumber || m.personId}</span>
                  {m.memberNumber && <span className="text-muted-foreground ml-2 text-xs font-mono">#{m.memberNumber}</span>}
                </button>
              ))}
            </div>
          )}
          {personId && (
            <p className="text-xs text-muted-foreground mt-1">Selected: {memberSearch}</p>
          )}
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
              <SelectItem value="bankTransfer">Bank Transfer</SelectItem>
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
            <Button onClick={() => (recordMutation as any).mutate({ body: { organizationId: orgId, personId, amount: amountCents, currency: 'PHP', paymentMethod, paidAt: paymentDate ? new Date(paymentDate).toISOString() : undefined, referenceNumber: referenceNumber || undefined } })} disabled={recordMutation.isPending}>
              {recordMutation.isPending ? 'Recording...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
