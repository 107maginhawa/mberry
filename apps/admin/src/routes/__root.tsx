/// <reference types="vite/client" />
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import '@/styles/globals.css'

export const Route = createRootRoute({
  component: RootComponent,
})

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Users', icon: Users },
  { to: '/', label: 'Permissions', icon: ShieldCheck },
  { to: '/', label: 'Settings', icon: Settings },
]

function RootComponent() {
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
          {navItems.map((item) => (
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
          Platform Admin
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
