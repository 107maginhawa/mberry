import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { NotFound } from './components/patterns/not-found'
import type { User, Session } from 'better-auth'
import type { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  auth: {
    user: User | null
    session: Session | null
    person: any | null
  }
  queryClient: QueryClient
}

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    context: {
      auth: undefined!, // Provided by RouterProvider in main.tsx
      queryClient: undefined!, // Provided by RouterProvider in main.tsx
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
