/// <reference types="vite/client" />
import { createRootRouteWithContext, Link, Outlet, redirect } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  Building2,
  Building,
  Users,
  UserCog,
  ToggleLeft,
  ShieldCheck,
  Shield,
} from 'lucide-react'
import type { RouterContext } from '@/router'
import { ROUTE_ROLES, useAdminUser } from '@/lib/role-gate'
import '@/styles/globals.css'

const MEMBERRY_LOGIN_URL = import.meta.env.VITE_MEMBERRY_URL
  ? `${import.meta.env.VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin`
  : 'http://localhost:3004/auth/sign-in?redirect=admin'

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="rounded-lg border bg-card p-8 max-w-md w-full text-center">
        <Shield className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
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
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      // Admin has no auth UI — redirect to memberry sign-in
      window.location.href = MEMBERRY_LOGIN_URL
      throw redirect({ to: '/' })
    }
  },
  errorComponent: RootErrorComponent,
  component: RootComponent,
})

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/associations', label: 'Associations', icon: Building2 },
  { to: '/organizations', label: 'Organizations', icon: Building },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/operators', label: 'Operators', icon: ShieldCheck },
  { to: '/impersonate', label: 'Impersonate', icon: UserCog },
  { to: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
  { to: '/audit', label: 'Audit Log', icon: Shield },
]

function RootComponent() {
  const user = useAdminUser()
  const visibleNavItems = navItems.filter((item) => {
    const allowed = ROUTE_ROLES[item.to]
    return !allowed || allowed.includes(user.role)
  })

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className="flex flex-col w-[260px] min-w-[260px] bg-[#2D2635] text-white"
      >
        {/* Logo area */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-sm font-bold">
            M
          </div>
          <span className="text-base font-semibold tracking-tight">
            Memberry Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              activeProps={{
                className: 'bg-white/10 text-white',
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
          <span className="capitalize">{user.role}</span> — {user.email}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
