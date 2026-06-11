import { RouterProvider } from '@tanstack/react-router'
import { ApiProvider, createDefaultQueryClient } from '@monobase/sdk-ts/react/provider'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import { createRouter } from './router'

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`

// Hoisted so router guards can use queryClient.ensureQueryData() for caching.
// Uses SDK defaults: staleTime 5min, gcTime 30min, smart retry (skips 4xx).
const queryClient = createDefaultQueryClient(toast)
const router = createRouter()

/**
 * InnerApp — loads session before rendering the router.
 * Person data is fetched per-page (profile page handles its own query).
 * Guards only need user/session — not person.
 */
function InnerApp() {
  const { data: session, isPending: sessionPending } = useSession()

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
