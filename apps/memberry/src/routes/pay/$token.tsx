import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

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
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alreadyPaid, setAlreadyPaid] = useState(false)

  useEffect(() => {
    fetch(`/api/pay/${encodeURIComponent(token)}/validate`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'already_paid') {
          setAlreadyPaid(true)
        } else if (data.valid) {
          setInvoice(data)
        } else {
          setError(data.error || 'Invalid payment link')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Network error. Please try again.')
        setLoading(false)
      })
  }, [token])

  const handlePay = async () => {
    if (!invoice) return
    setPaying(true)
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}/checkout`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        setError(data.error || 'Failed to start payment')
        setPaying(false)
      }
    } catch {
      setError('Network error. Please try again.')
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
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <h1 className="text-xl font-bold text-destructive">Payment Link Invalid</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold">Already Paid</h1>
          <p className="text-muted-foreground">This invoice has already been paid. Thank you!</p>
        </div>
      </div>
    )
  }

  if (!invoice) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full border rounded-lg bg-white overflow-hidden">
        <div className="bg-primary p-6 text-primary-foreground text-center">
          <p className="text-sm opacity-80">Amount Due</p>
          <p className="text-3xl font-bold mt-1">
            {formatAmount(invoice.amount, invoice.currency)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          {invoice.orgName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Organization:</span>{' '}
              <span className="font-medium">{invoice.orgName}</span>
            </div>
          )}
          {invoice.memberName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Member:</span>{' '}
              <span className="font-medium">{invoice.memberName}</span>
            </div>
          )}
          {invoice.dueDate && (
            <div className="text-sm">
              <span className="text-muted-foreground">Due Date:</span>{' '}
              <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
          >
            {paying ? 'Redirecting to payment...' : 'Pay Now'}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Secure payment via GCash, Maya, or card
          </p>
        </div>
      </div>
    </div>
  )
}
