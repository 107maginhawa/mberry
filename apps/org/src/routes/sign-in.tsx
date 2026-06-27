import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Button, Card } from '@monobase/ui'
import { signIn } from '@/features/auth/sign-in'
import { useSession } from '@/features/auth/use-session'
import { API_BASE } from '@/lib/api'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Redirect already-authed users away from the sign-in page.
  useEffect(() => {
    if (status === 'authed') void navigate({ to: '/' })
  }, [status, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const res = await signIn(email, password, API_BASE)
    setBusy(false)
    if (res.ok) { await qc.invalidateQueries({ queryKey: ['session'] }); navigate({ to: '/' }) }
    else setError(res.error)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="text-section font-semibold text-foreground">Officer sign in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-body">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-tap rounded-md border px-3 text-body" />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-body">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-tap rounded-md border px-3 text-body" />
          </div>
          {error && <p role="alert" className="text-body text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full min-h-tap">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </Card>
    </div>
  )
}
