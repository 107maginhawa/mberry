import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { signOut } from './sign-in'
import { API_BASE } from '@/lib/api'

/**
 * SignOutButton — the member's "emergency exit" (Nielsen #3: user control &
 * freedom). Signs out server-side, drops the cached session, returns to /sign-in.
 */
export function SignOutButton() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="ghost"
      disabled={busy}
      className="w-full text-muted-foreground"
      onClick={async () => {
        if (busy) return
        setBusy(true)
        await signOut(API_BASE)
        await qc.invalidateQueries({ queryKey: ['session'] })
        navigate({ to: '/sign-in' })
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
