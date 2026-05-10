import { QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ApiProvider } from '@monobase/sdk-ts/react/provider'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import { createRouter } from './router'

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`

// Hoisted so router guards can use queryClient.ensureQueryData() for caching
const queryClient = new QueryClient()
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
        <div className="animate-spin h-8 w-8 border-4 border-[#554B68] border-t-transparent rounded-full" />
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

createRoot(document.getElementById('root')!).render(<App />)
