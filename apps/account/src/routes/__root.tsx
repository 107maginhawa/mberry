/// <reference types="vite/client" />
import {
  createRootRouteWithContext,
  useRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { RouterContext } from '@/router'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'
import { Toaster } from 'sonner'
import { useAuthClient } from '@monobase/sdk-ts/react/auth'
import { getPersonQueryKey } from '@monobase/sdk-ts/generated/react-query'
import '@/styles/globals.css'

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="rounded-lg border bg-card p-8 max-w-md w-full text-center">
        <h1 className="text-h3 mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">{error?.message ?? 'An unexpected error occurred.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  errorComponent: RootErrorComponent,
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const authClient = useAuthClient()
  const queryClient = useQueryClient()

  return (
    <AuthUIProviderTanstack
      authClient={authClient}
      persistClient={false}
      navigate={(href) => router.navigate({ to: href, replace: true })}
      replace={(href) => router.navigate({ to: href, replace: true })}
      onSessionChange={async () => {
        // Invalidate session and person queries to trigger refetch after auth state changes
        await queryClient.invalidateQueries({ queryKey: ['session'] })
        await queryClient.invalidateQueries({
          queryKey: getPersonQueryKey({ path: { person: 'me' } }),
        })

        // Force router to re-evaluate guards after auth state changes
        router.invalidate()
      }}
      Link={({ href, ...props }: { href: string; [key: string]: any }) => <Link to={href} {...props} />}
      emailVerification
      emailOTP
      credentials
      apiKey
      magicLink
      passkey
      twoFactor={["otp", "totp"]}
    >
      <Outlet />
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={true}
        duration={4000}
      />
    </AuthUIProviderTanstack>
  )
}
