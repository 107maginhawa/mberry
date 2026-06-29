import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { configureApiClient, API_BASE } from './lib/api'
import { routeTree } from './routeTree.gen'
import { RouteError } from './components/RouteError'
import { NotFound } from './components/NotFound'
import './styles.css'

configureApiClient(API_BASE)

// App-wide fallbacks: every route inherits a friendly, recoverable error
// boundary (defaultErrorComponent) and a 404 (defaultNotFoundComponent) instead
// of a blank screen / bare router default.
const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
)
