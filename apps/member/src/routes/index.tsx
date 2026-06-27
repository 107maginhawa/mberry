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
    if (status === 'authed') navigate({ to: '/dashboard' })
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
