import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/features/auth/use-session'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

function IndexRedirect() {
  const { status } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (status === 'authed') navigate({ to: '/dashboard' as any }) // route added in later task
    else if (status === 'unauthed') navigate({ to: '/sign-in' })
  }, [status, navigate])

  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen flex items-center justify-center"
    />
  )
}
