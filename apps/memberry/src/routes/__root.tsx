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
      <Outlet />
      <Toaster position="top-right" richColors closeButton expand duration={4000} />
    </AuthUIProviderTanstack>
  )
}
