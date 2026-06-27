import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { configureApiClient } from './lib/api'
import { routeTree } from './routeTree.gen'
import './styles.css'

configureApiClient(import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`)

const router = createRouter({ routeTree })

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
