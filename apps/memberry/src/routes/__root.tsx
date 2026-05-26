/// <reference types="vite/client" />
import {
  createRootRouteWithContext,
  useRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'
import { Toaster } from 'sonner'
import { useAuthClient } from '@monobase/sdk-ts/react/auth'
import { getPersonQueryKey } from '@monobase/sdk-ts/generated/react-query'
import type { RouterContext } from '@/router'
import '@/styles/globals.css'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-[var(--color-bg)]">
      <h1 className="text-hero text-[var(--color-primary)]">404</h1>
      <p className="text-h3 text-[var(--color-text)]">Page not found</p>
      <p className="text-body-sm text-[var(--color-text-secondary)] max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="mt-4 px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-body-sm font-medium hover:opacity-90 transition-opacity">
        Go home
      </Link>
    </div>
  )
}

function RootComponent() {
  const router = useRouter()
  const authClient = useAuthClient()
  const queryClient = useQueryClient()

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
    <AuthUIProviderTanstack
      authClient={authClient}
      persistClient={false}
      navigate={(href) => router.navigate({ to: href, replace: true })}
      replace={(href) => router.navigate({ to: href, replace: true })}
      onSessionChange={async () => {
        await queryClient.invalidateQueries({ queryKey: ['session'] })
        await queryClient.invalidateQueries({
          queryKey: getPersonQueryKey({ path: { person: 'me' } }),
        })
        router.invalidate()
      }}
      Link={({ href, ...props }: { href: string; [key: string]: any }) => (
        <Link to={href} {...props} />
      )}
      credentials
    >
      <div id="main-content">
        <Outlet />
      </div>
      <Toaster position="top-right" richColors closeButton expand duration={4000} />
    </AuthUIProviderTanstack>
    </>
  )
}
