import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, ErrorState, Input, centavosToPhp } from '@monobase/ui'
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

  // Money-step confirmation (DESIGN.md: confirm at every money step + ConfirmDialog
  // for consequential mutations). A typo'd custom amount or a fat-finger Revoke is
  // live money — gate both behind an explicit "are you sure".
  const [ask, setAsk] = useState<
    null | { title: string; description: string; confirmLabel: string; run: () => void }
  >(null)
  const confirmEl = ask ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) setAsk(null) }}
      title={ask.title}
      description={ask.description}
      confirmLabel={ask.confirmLabel}
      onConfirm={() => { ask.run(); setAsk(null) }}
    />
  ) : null

  // Sent panel — show once the link is minted
  if (state.kind === 'sent') {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        <h1 className="text-title font-semibold text-foreground">Pay-link for {memberName}</h1>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <p className="text-body text-foreground break-all">{state.url}</p>
            <p className="text-caption text-muted-foreground">Expires {new Date(state.expiresAt).toLocaleDateString('en-PH')}</p>
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
              <Button asChild variant="outline" className="min-h-tap">
                <a href={`sms:?body=${encodeURIComponent(state.url)}`} aria-label="Share via SMS">
                  Share via SMS
                </a>
              </Button>
              <Button
                variant="destructive"
                className="min-h-tap"
                onClick={() => setAsk({
                  title: 'Revoke this pay-link?',
                  description: `${memberName} won't be able to use this link anymore. You can send a new one anytime.`,
                  confirmLabel: 'Yes, revoke',
                  run: onRevoke,
                })}
                aria-label="Revoke link"
              >
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>
        {confirmEl}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h1 className="text-title font-semibold text-foreground">Send pay-link to {memberName}</h1>

      {state.kind === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.kind === 'revoked' && (
        <Alert className="border-warning bg-warning-bg text-warning">
          <AlertDescription>Link revoked.</AlertDescription>
        </Alert>
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
                  <span className="text-body font-semibold text-foreground">{centavosToPhp(inv.amount)}</span>
                  <span className="text-caption text-muted-foreground capitalize">{inv.status}</span>
                </div>
                <Button
                  className="min-h-tap"
                  disabled={state.kind === 'minting'}
                  onClick={() => setAsk({
                    title: 'Send pay-link?',
                    description: `Send ${memberName} a payment link for ${centavosToPhp(inv.amount)}?`,
                    confirmLabel: 'Send pay-link',
                    run: () => onSendInvoice(inv.id, inv.amount),
                  })}
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
            <span className="text-body text-text-secondary font-medium">₱</span>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              aria-label="Amount in pesos"
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button
            className="min-h-tap"
            disabled={!customValid || state.kind === 'minting'}
            onClick={() => {
              if (!customValid) return
              setAsk({
                title: 'Send pay-link?',
                description: `Send ${memberName} a payment link for ${centavosToPhp(centavos)}?`,
                confirmLabel: 'Send pay-link',
                run: () => onSendCustom(centavos),
              })
            }}
            aria-label="Send custom amount link"
          >
            {state.kind === 'minting' ? 'Minting…' : 'Send link'}
          </Button>
        </CardContent>
      </Card>
      {confirmEl}
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
