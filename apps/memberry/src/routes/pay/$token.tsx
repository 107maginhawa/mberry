// ui-c-exempt: public-verify — public pay-by-token, no auth
// oli-execute: error-handled-inline
// `error` is the merge of pay-mutation error + fetch error; renders explicit
// branch. Gate heuristic misses the destructured rename `error: fetchError`.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@monobase/ui'
import { api } from '@/lib/api'

// oli-ui: exempt-pageshell — public invoice-payment micro-page; centered single-card flow
export const Route = createFileRoute('/pay/$token')({
  component: PublicPaymentPage,
})

interface InvoiceInfo {
  valid: boolean
  invoiceId: string
  amount: number
  currency: string
  memberName?: string
  orgName?: string
  dueDate?: string
}

/**
 * Public payment page — no auth required.
 * Validates HMAC-signed token, shows invoice details, initiates checkout.
 */
function PublicPaymentPage() {
  const { token } = Route.useParams()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const { data, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['pay-validate', token],
    queryFn: () => api.get<any>(`/api/pay/${encodeURIComponent(token)}/validate`),
  })

  const alreadyPaid = data?.status === 'already_paid'
  const invoice: InvoiceInfo | null = data?.valid ? data : null
  const error = payError || (fetchError ? 'Network error. Please try again.' : (data && !data.valid && !alreadyPaid ? (data.error || 'Invalid payment link') : null))

  const handlePay = async () => {
    if (!invoice) return
    setPaying(true)
    try {
      const result = await api.post<any>(`/api/pay/${encodeURIComponent(token)}/checkout`)
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        setPayError(result.error || 'Failed to start payment')
        setPaying(false)
      }
    } catch {
      setPayError('Network error. Please try again.')
      setPaying(false)
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
    }).format(amount / 100) // Convert from centavos
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <h1 className="text-h3 text-[var(--color-error)]">Payment Link Invalid</h1>
          <p className="text-[var(--color-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  if (alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-h3">Already Paid</h1>
          <p className="text-[var(--color-muted)]">This invoice has already been paid. Thank you!</p>
        </div>
      </div>
    )
  }

  if (!invoice) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full border rounded-lg bg-white overflow-hidden">
        <div className="bg-[var(--color-primary)] p-6 text-white text-center">
          <p className="text-sm opacity-80">Amount Due</p>
          <p className="text-3xl font-bold mt-1">
            {formatAmount(invoice.amount, invoice.currency)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          {invoice.orgName && (
            <div className="text-sm">
              <span className="text-[var(--color-muted)]">Organization:</span>{' '}
              <span className="font-medium">{invoice.orgName}</span>
            </div>
          )}
          {invoice.memberName && (
            <div className="text-sm">
              <span className="text-[var(--color-muted)]">Member:</span>{' '}
              <span className="font-medium">{invoice.memberName}</span>
            </div>
          )}
          {invoice.dueDate && (
            <div className="text-sm">
              <span className="text-[var(--color-muted)]">Due Date:</span>{' '}
              <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <Button
            className="w-full"
            onClick={handlePay}
            disabled={paying}
          >
            {paying ? 'Redirecting to payment...' : 'Pay Now'}
          </Button>
          <p className="text-xs text-center text-[var(--color-muted)]">
            Secure payment via GCash, Maya, or card
          </p>
        </div>
      </div>
    </div>
  )
}
