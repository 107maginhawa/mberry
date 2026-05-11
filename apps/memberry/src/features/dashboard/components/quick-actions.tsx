import { Link } from '@tanstack/react-router'
import { CreditCard, IdCard, Award, Calendar, User, BookOpen } from 'lucide-react'

interface QuickAction {
  icon: React.ReactNode
  label: string
  to: string
  params?: Record<string, string>
}

interface QuickActionsProps {
  /** Org with unpaid dues (prioritized), falling back to first org */
  duesOrgId?: string
  /** First org for event browsing */
  eventsOrgId?: string
}

export function QuickActions({ duesOrgId, eventsOrgId }: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      icon: <CreditCard size={20} />,
      label: duesOrgId ? 'Pay Dues' : 'Payments',
      to: duesOrgId ? '/org/$orgId/dues' : '/my/payments',
      params: duesOrgId ? { orgId: duesOrgId } : undefined,
    },
    {
      icon: <IdCard size={20} />,
      label: 'ID Card',
      to: '/my/id-card',
    },
    {
      icon: <Award size={20} />,
      label: 'Certificates',
      to: '/my/certificates',
    },
    {
      icon: <Calendar size={20} />,
      label: 'Events',
      to: eventsOrgId ? '/org/$orgId/events' : '/my/events',
      params: eventsOrgId ? { orgId: eventsOrgId } : undefined,
    },
    {
      icon: <BookOpen size={20} />,
      label: 'Credits',
      to: '/my/credits',
    },
    {
      icon: <User size={20} />,
      label: 'Profile',
      to: '/my/profile',
    },
  ]

  return (
    <section>
      <h3 className="text-[14px] font-semibold font-display text-[var(--color-muted)] mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            params={action.params ?? {}}
            className="flex flex-col items-center gap-1.5 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-cream-dark)] hover:bg-[var(--color-cream-light)] transition-colors"
          >
            <span className="text-[var(--color-primary)]" aria-hidden="true">{action.icon}</span>
            <span className="text-[11px] font-semibold text-center">{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
