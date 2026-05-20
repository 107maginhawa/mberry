import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  listDuesFundsOptions,
  listRosterMembersOptions,
  recordDuesPaymentMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { DuesFund } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { parseCentsInput } from '../lib/money'
import { FundAllocationPreview } from './fund-allocation-preview'

const recordPaymentSchema = z.object({
  amount: z
    .number({ error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  referenceNumber: z.string().optional(),
})

type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>

interface RecordPaymentFormProps {
  orgId: string
}

export function RecordPaymentForm({ orgId }: RecordPaymentFormProps) {
  const [personId, setPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<RecordPaymentFormData | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentFormData>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount: undefined,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      referenceNumber: '',
    },
  })

  const amountValue = watch('amount')
  const amountCents = amountValue && !Number.isNaN(amountValue) ? Math.round(amountValue * 100) : 0

  const { data: fundsData } = useQuery(listDuesFundsOptions({ query: { organizationId: orgId }, headers: { 'x-org-id': orgId } }))

  const funds = (fundsData?.data ?? []).map((f: DuesFund) => ({
    fundId: f.name,
    percentage: f.percentage,
  }))

  const recordMutation = useMutation({
    ...recordDuesPaymentMutation(),
    onSuccess: () => {
      setShowConfirm(false)
      toast.success('Payment recorded', { description: 'Receipt sent to member.' })
      setPersonId('')
      setMemberSearch('')
      setPendingData(null)
      reset()
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
      headers: { 'x-org-id': orgId },
    }),
    enabled: debouncedSearch.length >= 2,
  })

  const memberResults = memberSearchData?.data ?? []

  function selectMember(m: { personId: string; memberNumber?: string; id: string }) {
    setPersonId(m.personId || m.id)
    setMemberSearch(m.memberNumber || m.personId)
    setDebouncedSearch('')
  }

  function onSubmit(data: RecordPaymentFormData) {
    if (!personId) {
      toast.error('Please select a member')
      return
    }
    setPendingData(data)
    setShowConfirm(true)
  }

  const amountCentsDisplay = pendingData
    ? Math.round(pendingData.amount * 100)
    : amountCents

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="relative">
          <Label>Member</Label>
          <Input
            value={memberSearch}
            onChange={(e) => { setMemberSearch(e.target.value); setPersonId('') }}
            placeholder="Search by name or license number..."
          />
          {searchingMembers && <p className="text-xs text-[var(--color-muted)] mt-1">Searching...</p>}
          {memberResults.length > 0 && !personId && (
            <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-white relative z-50 shadow-lg">
              {memberResults.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 text-sm"
                  onClick={() => selectMember(m)}
                >
                  <span className="font-medium">{m.memberNumber || m.personId}</span>
                  {m.memberNumber && <span className="text-[var(--color-muted)] ml-2 text-xs font-mono">#{m.memberNumber}</span>}
                </Button>
              ))}
            </div>
          )}
          {personId && (
            <p className="text-xs text-[var(--color-muted)] mt-1">Selected: {memberSearch}</p>
          )}
        </div>

        <div>
          <Label htmlFor="amount">Amount (PHP)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            aria-describedby={errors.amount ? 'amount-error' : undefined}
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && (
            <p id="amount-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
              {errors.amount.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="paymentDate">Date</Label>
          <Input
            id="paymentDate"
            type="date"
            aria-describedby={errors.paymentDate ? 'paymentDate-error' : undefined}
            {...register('paymentDate')}
          />
          {errors.paymentDate && (
            <p id="paymentDate-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
              {errors.paymentDate.message}
            </p>
          )}
        </div>

        <div>
          <Label>Payment Method</Label>
          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-describedby={errors.paymentMethod ? 'paymentMethod-error' : undefined}>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bankTransfer">Bank Transfer</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.paymentMethod && (
            <p id="paymentMethod-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
              {errors.paymentMethod.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="referenceNumber">Reference Number (optional)</Label>
          <Input
            id="referenceNumber"
            placeholder="Check/bank/GCash reference"
            {...register('referenceNumber')}
          />
        </div>

        <Button type="submit" disabled={!personId}>
          Record Payment
        </Button>
      </form>

      <div className="p-4 bg-[var(--color-surface-warm)] rounded-lg">
        {amountCents > 0 ? (
          <FundAllocationPreview amountCents={amountCents} funds={funds} />
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Enter an amount to see fund allocation.</p>
        )}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Record payment of <span className="font-mono font-medium">₱{(amountCentsDisplay / 100).toFixed(2)}</span> for this member?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!pendingData) return
                recordMutation.mutate({
                  body: {
                    organizationId: orgId,
                    personId,
                    // BigInt is safe here: sdk-ts jsonBodySerializer (bodySerializer.gen.ts:62)
                    // uses a JSON.stringify replacer that converts BigInt to string before transmission.
                    amount: BigInt(Math.round(pendingData.amount * 100)),
                    currency: 'PHP',
                    paymentMethod: pendingData.paymentMethod as 'online' | 'cash' | 'check' | 'bankTransfer' | 'gcash' | 'other',
                    paidAt: pendingData.paymentDate ? new Date(pendingData.paymentDate) : undefined,
                    referenceNumber: pendingData.referenceNumber || undefined,
                  },
                  headers: { 'x-org-id': orgId },
                })
              }}
              disabled={recordMutation.isPending}
            >
              {recordMutation.isPending ? 'Recording...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
