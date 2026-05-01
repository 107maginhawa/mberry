import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: requireAuth,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as any

  return (
    <div className="flex min-h-screen">
      <aside className="w-[240px] bg-[#554B68] text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-bold tracking-tight">Memberry</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/dashboard" label="Dashboard" />
          <NavLink to="/my/profile" label="My Profile" />
          <NavLink to="/my/organizations" label="Organizations" />
          <NavLink to="/my/settings" label="Settings" />
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/50">
          {user?.email}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
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
