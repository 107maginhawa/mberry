import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { routeTree } from './routeTree.gen'
import type { RouterContext } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  context: {
    auth: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const [auth, setAuth] = useState<RouterContext['auth']>({ user: null, loading: true })

  useEffect(() => {
    fetch('/api/admin/me/role', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setAuth({ user: { email: data.email, name: data.name, role: data.role }, loading: false })
        } else {
          setAuth({ user: null, loading: false })
        }
      })
      .catch(() => setAuth({ user: null, loading: false }))
  }, [])

  if (auth.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth }} />
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
