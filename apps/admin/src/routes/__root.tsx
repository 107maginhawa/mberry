/// <reference types="vite/client" />
import { createRootRouteWithContext, Link, Outlet, redirect } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  Building2,
  Building,
  Users,
  Users2,
  UserCog,
  ToggleLeft,
  ShieldCheck,
  Shield,
  Calendar,
  GraduationCap,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Radio,
  Mail,
  ShieldAlert,
  FileText,
} from 'lucide-react'
import { Button } from '@monobase/ui'
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
        <h1 className="text-h1 mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">{error?.message ?? 'An unexpected error occurred.'}</p>
        <Button onClick={() => window.location.reload()}>
          Reload page
        </Button>
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

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/associations', label: 'Associations', icon: Building2 },
      { to: '/organizations', label: 'Organizations', icon: Building },
      { to: '/operators', label: 'Operators', icon: ShieldCheck },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/national-dashboard', label: 'National Dashboard', icon: BarChart3 },
      { to: '/members', label: 'Members', icon: Users },
      { to: '/verifications', label: 'Verifications', icon: ShieldCheck },
      { to: '/compliance', label: 'Compliance', icon: ClipboardCheck },
      { to: '/events', label: 'Events', icon: Calendar },
      { to: '/training', label: 'Training', icon: GraduationCap },
      { to: '/committees', label: 'Committees', icon: Users2 },
    ],
  },
  {
    title: 'Communications',
    items: [
      { to: '/communications', label: 'Broadcasts', icon: Radio },
      { to: '/communications/moderation', label: 'Moderation', icon: ShieldAlert },
      { to: '/communications/templates', label: 'Templates', icon: FileText },
      { to: '/communications/email', label: 'Email Health', icon: Mail },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { to: '/surveys', label: 'Surveys', icon: ClipboardList },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/audit', label: 'Audit Log', icon: Shield },
      { to: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
      { to: '/impersonate', label: 'Impersonate', icon: UserCog },
    ],
  },
]

function MobileGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-center lg:hidden">
      <Shield className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-xl font-bold mb-2">Desktop Required</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The admin dashboard requires a screen width of at least 1024px. Please switch to a desktop browser for the best experience.
      </p>
    </div>
  )
}

function RootComponent() {
  const user = useAdminUser()

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const allowed = ROUTE_ROLES[item.to]
        return !allowed || allowed.includes(user.role)
      }),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <>
    <MobileGate />
    <div className="hidden lg:flex h-screen">
      {/* Sidebar */}
      <aside
        className="flex flex-col w-[260px] min-w-[260px] bg-admin-chrome text-white"
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
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {visibleSections.map((section, idx) => (
            <div key={section.title} className={idx > 0 ? 'mt-6' : ''}>
              <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-white/60">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === '/' }}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    activeProps={{
                      className: 'bg-white/15 text-white border-l-2 border-white',
                      'aria-current': 'page' as const,
                    }}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <span className="capitalize">{user.role}</span> — {user.email}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
    </>
  )
}
