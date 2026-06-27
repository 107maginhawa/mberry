import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, centavosToPhp } from '@monobase/ui'
import { listDuesInvoices } from '@monobase/sdk-ts/generated'
import { Route } from '@/routes/members/$membershipId/send'
import { useSelectedOrg } from '@/features/org/use-org'
import { useSendLink, type SendState } from './use-send-link'

// ─── Presentational ──────────────────────────────────────────────────────────

export interface InvoiceItem {
  id: string
  amount: number
  status: string
}

export interface SendLinkViewProps {
  memberName: string
  invoices: InvoiceItem[]
  state: SendState
  onSendInvoice: (invoiceId: string, amount: number) => void
  onSendCustom: (amount: number) => void
  onRevoke: () => void
}

export function SendLinkView({
  memberName,
  invoices,
  state,
  onSendInvoice,
  onSendCustom,
  onRevoke,
}: SendLinkViewProps) {
  const [pesoInput, setPesoInput] = useState('')
  const centavos = Math.round(parseFloat(pesoInput) * 100)
  const customValid = pesoInput !== '' && !isNaN(centavos) && centavos > 0

  // Sent panel — show once the link is minted
  if (state.kind === 'sent') {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        <h1 className="text-title font-semibold text-plum-900">Pay-link for {memberName}</h1>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <p className="text-body text-plum-900 break-all">{state.url}</p>
            <p className="text-caption text-plum-500">Expires {new Date(state.expiresAt).toLocaleDateString('en-PH')}</p>
            <div className="flex gap-3 flex-wrap">
              <Button
                className="min-h-tap"
                onClick={() => {
                  navigator.clipboard.writeText(state.url)
                  toast.success('Link copied')
                }}
              >
                Copy link
              </Button>
              <a
                href={`sms:?body=${encodeURIComponent(state.url)}`}
                className="min-h-tap inline-flex items-center justify-center rounded-md border border-plum-300 px-4 text-sm font-medium text-plum-700 hover:bg-plum-50 focus-visible:outline focus-visible:outline-2"
                aria-label="Share via SMS"
              >
                Share via SMS
              </a>
              <Button
                variant="destructive"
                className="min-h-tap"
                onClick={onRevoke}
                aria-label="Revoke link"
              >
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h1 className="text-title font-semibold text-plum-900">Send pay-link to {memberName}</h1>

      {state.kind === 'error' && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {state.kind === 'revoked' && (
        <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          Link revoked.
        </div>
      )}

      {/* Outstanding invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outstanding invoices</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body font-semibold text-plum-900">{centavosToPhp(inv.amount)}</span>
                  <span className="text-caption text-plum-500 capitalize">{inv.status}</span>
                </div>
                <Button
                  className="min-h-tap"
                  disabled={state.kind === 'minting'}
                  onClick={() => onSendInvoice(inv.id, inv.amount)}
                  aria-label={`Send link for ${centavosToPhp(inv.amount)} invoice`}
                >
                  Send link
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Custom amount */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom amount</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-body text-plum-600 font-medium">₱</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              aria-label="Amount in pesos"
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              className="flex-1 rounded-md border border-plum-200 px-3 py-2 text-body text-plum-900 focus:outline-none focus:ring-2 focus:ring-plum-500 min-h-tap"
            />
          </div>
          <Button
            className="min-h-tap"
            disabled={!customValid || state.kind === 'minting'}
            onClick={() => { if (customValid) onSendCustom(centavos) }}
            aria-label="Send custom amount link"
          >
            {state.kind === 'minting' ? 'Minting…' : 'Send link'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

export default function SendLink() {
  const { membershipId } = Route.useParams()
  const { personId, name } = Route.useSearch()
  const { orgId } = useSelectedOrg()

  const effectiveOrgId = orgId ?? ''
  const effectivePersonId = personId ?? ''
  const memberName = name ?? 'Member'

  const { state, mint, revoke } = useSendLink(effectiveOrgId, effectivePersonId)

  // Fetch outstanding invoices for this membership
  const { data: invoicesData } = useQuery({
    queryKey: ['dues-invoices', membershipId],
    enabled: !!membershipId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({
        query: { membershipId, pageSize: 50 },
      })
      return data?.data ?? []
    },
  })

  const invoices: InvoiceItem[] = (invoicesData ?? [])
    .filter((inv) => ['generated', 'sent', 'overdue'].includes(inv.status))
    .map((inv) => ({
      id: inv.id,
      // totalAmount is bigint at runtime — coerce for display + SDK boundary
      amount: Number(inv.totalAmount),
      status: inv.status,
    }))

  return (
    <SendLinkView
      memberName={memberName}
      invoices={invoices}
      state={state}
      onSendInvoice={(invoiceId, amount) => mint({ amount, invoiceId })}
      onSendCustom={(amount) => mint({ amount })}
      onRevoke={revoke}
    />
  )
}
