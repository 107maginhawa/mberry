import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { routeTree } from './routeTree.gen'
import type { RouterContext, AdminUser } from './router'
import { AdminUserContext } from './lib/role-gate'
import { getAdminRole } from '@monobase/sdk-ts/generated/sdk.gen'
import type { AdminRoleResponse } from '@monobase/sdk-ts/generated/types.gen'
import { seedCsrfToken } from '@monobase/sdk-ts/csrf'

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
    void seedCsrfToken('/api')
    getAdminRole()
      .then(({ data }) => {
        if (data) {
          const adminData = data as AdminRoleResponse
          setAuth({ user: { email: adminData.email, name: adminData.name, role: adminData.role as AdminUser['role'] }, loading: false })
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
    <AdminUserContext.Provider value={auth.user}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ auth }} />
      </QueryClientProvider>
    </AdminUserContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
