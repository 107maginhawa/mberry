/// <reference types="vite/client" />
import {
  createRootRouteWithContext,
  useRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'
import { Toaster } from 'sonner'
import { useAuthClient } from '@monobase/sdk-ts/react/auth'
import { getPersonQueryKey } from '@monobase/sdk-ts/generated/react-query'
import '@/styles/globals.css'

export interface RouterContext {
  queryClient: QueryClient
}

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
      Link={({ href, ...props }: { href: string; [key: string]: any }) => <Link to={href} {...props} />}
      credentials
    >
      <div className="flex min-h-screen">
        {/* Officer Sidebar */}
        <aside className="w-[240px] bg-[#554B68] text-white flex flex-col shrink-0">
          <div className="p-4 border-b border-white/10">
            <h1 className="text-lg font-bold tracking-tight">
              Memberry
            </h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavLink to="/" label="Dashboard" />
            <NavLink to="/org" label="Organizations" />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

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

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="block px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      activeProps={{ className: 'block px-3 py-2 rounded-md text-sm text-white bg-white/15' }}
    >
      {label}
    </Link>
  )
}
