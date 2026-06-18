import { RouterProvider } from '@tanstack/react-router'
import { ApiProvider, createDefaultQueryClient } from '@monobase/sdk-ts/react/provider'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import { createRouter } from './router'

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`

// Hoisted so router guards can use queryClient.ensureQueryData() for caching.
// Uses SDK defaults: staleTime 5min, gcTime 30min, smart retry (skips 4xx).
const queryClient = createDefaultQueryClient(toast)
const router = createRouter()

/**
 * ConnectionError — shown when the session bootstrap can't reach the API.
 * Replaces the previous behavior where an unreachable backend left the user
 * staring at a perpetual spinner on a blank screen with no recovery path.
 */
function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6"
    >
      <h1 className="text-h2 text-[var(--color-text)]">Can&rsquo;t reach Memberry</h1>
      <p className="text-body-sm text-[var(--color-text-secondary)] max-w-sm">
        We&rsquo;re having trouble connecting to the server. Check your internet
        connection and try again.
      </p>
      <Button type="button" size="card" onClick={onRetry} className="mt-2">
        Try again
      </Button>
    </div>
  )
}

/**
 * InnerApp — loads session before rendering the router.
 * Person data is fetched per-page (profile page handles its own query).
 * Guards only need user/session — not person.
 */
function InnerApp() {
  const { data: session, isPending: sessionPending, error, refetch } = useSession()
  // If the session request keeps failing (server unreachable / 5xx), the query
  // can stay pending indefinitely. Surface a recoverable error state after a
  // grace period instead of spinning forever on a blank screen.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!sessionPending) {
      setTimedOut(false)
      return
    }
    const timer = setTimeout(() => setTimedOut(true), 10_000)
    return () => clearTimeout(timer)
  }, [sessionPending])

  const handleRetry = () => {
    setTimedOut(false)
    if (typeof refetch === 'function') {
      refetch()
    } else {
      window.location.reload()
    }
  }

  // Logged-out users resolve to `data: null` with no error and fall through to
  // the router (requireAuth redirects to sign-in) — only real failures land here.
  if (error || (sessionPending && timedOut)) {
    return <ConnectionError onRetry={handleRetry} />
  }

  if (sessionPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  const context = {
    auth: {
      session: session?.session || null,
      user: session?.user || null,
      person: null, // Fetched per-page, not in bootstrap
    },
    queryClient,
  }

  return <RouterProvider router={router} context={context} />
}

function App() {
  return (
    <ApiProvider apiBaseUrl={API_BASE_URL} queryClient={queryClient} notifier={toast}>
      <InnerApp />
    </ApiProvider>
  )
}

const container = document.getElementById('root')!
// HMR root caching — HTMLElement doesn't have __root in typedefs
const root = (container as any).__root ?? createRoot(container) // eslint-disable-line @typescript-eslint/no-explicit-any
;(container as any).__root = root // eslint-disable-line @typescript-eslint/no-explicit-any
root.render(<App />)
