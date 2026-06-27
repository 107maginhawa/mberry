import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card } from '@monobase/ui'
import { requestOtp, verifyOtp } from '@/features/auth/sign-in'
import { API_BASE } from '@/lib/api'

/**
 * Two-step email-OTP sign-in form.
 *
 * Step 1 (email): member enters their email and clicks "Send code".
 * Step 2 (code):  member enters the 6-digit code sent to their email.
 *
 * On successful verify: invalidates the ['session'] query and navigates to /dashboard.
 * Code is sent by email only (phone OTP is a flagged follow-up, not implemented).
 *
 * a11y: 18px base via tokens.css, min-h-tap (≥48px) tap targets, labeled inputs,
 * role=alert on errors, one primary task per screen.
 */
export function SignInForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const res = await requestOtp(email, API_BASE)
    setBusy(false)
    if (res.ok) {
      toast.success('Code sent to your email')
      setStep('code')
    } else {
      setError(res.error)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const res = await verifyOtp(email, otp, API_BASE)
    setBusy(false)
    if (res.ok) {
      await qc.invalidateQueries({ queryKey: ['session'] })
      navigate({ to: '/dashboard' })
    } else {
      setError(res.error)
    }
  }

  async function handleResend(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const res = await requestOtp(email, API_BASE)
    setBusy(false)
    if (res.ok) {
      toast.success('Code sent to your email')
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="text-section font-semibold text-foreground">Member sign in</h1>

        {step === 'email' ? (
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-body">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-tap rounded-md border border-input px-3 text-body"
              />
            </div>
            {error && (
              <p role="alert" className="text-body text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full min-h-tap">
              {busy ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-body text-muted-foreground">
              We sent a 6-digit code to your email. Enter it below to sign in.
            </p>
            <div className="space-y-1">
              <label htmlFor="otp" className="text-body">
                6-digit code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full min-h-tap rounded-md border border-input px-3 text-body tracking-widest"
              />
            </div>
            {error && (
              <p role="alert" className="text-body text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full min-h-tap">
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </Button>
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="min-h-tap w-full text-body text-primary underline"
            >
              Resend code
            </button>
          </form>
        )}
      </Card>
    </div>
  )
}
