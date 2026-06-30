import { useState } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  centavosToPhp,
} from '@monobase/ui'
import { useRecordPayment, type PaymentMethod } from './use-member-detail'

// GCash is its own option (design A3: do NOT bury it under "Online").
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'check', label: 'Check' },
  { value: 'bankTransfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS.map((m) => [m.value, m.label]))

// Two-step money action (DESIGN.md: confirmation step at every money action). Step 1 enters
// the cash/GCash detail, step 2 reviews amount + method before writing recordDuesPayment.
export function RecordPaymentDialog({ orgId, personId, memberName }: { orgId: string; personId: string; memberName: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [amount, setAmount] = useState('') // pesos
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const record = useRecordPayment(orgId, personId)

  const pesos = Number(amount)
  const centavos = Math.round(pesos * 100)

  function reset() { setStep(1); setAmount(''); setMethod('cash'); setReference(''); setError(null) }

  function toReview() {
    if (!(pesos > 0)) return setError('Enter an amount greater than ₱0.')
    setError(null)
    setStep(2)
  }

  function submit() {
    record.mutate(
      { amount: centavos, currency: 'PHP', paymentMethod: method, referenceNumber: reference.trim() || undefined },
      {
        onSuccess: () => { toast.success(`Recorded ${centavosToPhp(centavos)} from ${memberName}`); reset(); setOpen(false) },
        onError: (e) => { setError(e.message); setStep(1); toast.error(e.message) },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button className="min-h-tap">Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Step 1 of 2 — enter the payment details.' : 'Step 2 of 2 — confirm and record.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rp-amount">Amount (₱)</Label>
              <Input id="rp-amount" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-tap" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rp-method">Payment method</Label>
              <select id="rp-method" className="min-h-tap rounded-md border border-[var(--color-border)] bg-surface px-3 text-body" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rp-ref">Reference number (optional)</Label>
              <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="min-h-tap" />
            </div>
            {error && <p role="alert" className="text-body text-[var(--color-error)]">{error}</p>}
            <Button className="min-h-tap" onClick={toReview}>Review</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface p-4 text-body">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Member</dt><dd className="font-medium">{memberName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{centavosToPhp(centavos)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Method</dt><dd className="font-medium">{METHOD_LABEL[method]}</dd></div>
              {reference.trim() && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reference</dt><dd className="font-medium">{reference.trim()}</dd></div>}
            </dl>
            {error && <p role="alert" className="text-body text-[var(--color-error)]">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="min-h-tap flex-1" onClick={() => setStep(1)} disabled={record.isPending}>Back</Button>
              <Button className="min-h-tap flex-1" onClick={submit} disabled={record.isPending}>{record.isPending ? 'Recording…' : 'Record payment'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
