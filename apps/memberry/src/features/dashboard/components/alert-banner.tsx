import { Link } from '@tanstack/react-router'
import { AlertTriangle, Vote, Clock, FileCheck } from 'lucide-react'

interface AlertItem {
  priority: number
  variant: 'error' | 'warning' | 'info'
  icon: React.ReactNode
  message: string
  action?: { label: string; to: string; params?: Record<string, string> }
}

interface AlertBannerProps {
  memberships: Array<{ orgId?: string; organizationId?: string; orgName?: string; status?: string; duesExpiryDate?: string }>
  invoices: Array<{ status: string; organizationId?: string }>
  elections: Array<{ id?: string; title?: string; status?: string; votingStart?: string; votingEnd?: string; organizationId?: string }>
}

export function AlertBanner({ memberships, invoices, elections }: AlertBannerProps) {
  const alerts: AlertItem[] = []
  const now = new Date()

  // Check overdue invoices
  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue')
  if (overdueInvoices.length > 0) {
    const orgId = overdueInvoices[0]?.organizationId
    alerts.push({
      priority: 1,
      variant: 'error',
      icon: <AlertTriangle size={16} />,
      message: `Dues overdue — ${overdueInvoices.length} unpaid invoice${overdueInvoices.length > 1 ? 's' : ''}`,
      action: orgId ? { label: 'Pay now', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
    })
  }

  // Check dues expiring within 60 days
  for (const m of memberships) {
    if (!m.duesExpiryDate) continue
    const expiry = new Date(m.duesExpiryDate)
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const orgId = m.orgId ?? m.organizationId

    // Check if this org has unpaid invoices
    const orgHasUnpaid = invoices.some(
      (inv) => inv.organizationId === orgId && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'writtenOff'
    )

    // Skip expiry warnings for active members with paid dues
    if (m.status === 'active' && !orgHasUnpaid) continue

    if (daysLeft <= 0 && orgHasUnpaid) {
      alerts.push({
        priority: 2,
        variant: 'error',
        icon: <AlertTriangle size={16} />,
        message: `Dues expired for ${m.orgName ?? 'your organization'}`,
        action: orgId ? { label: 'Renew now', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
      })
    } else if (daysLeft <= 0 && !orgHasUnpaid && overdueInvoices.length === 0) {
      // Period ended but all invoices paid — renewal invoice not yet generated
      alerts.push({
        priority: 7,
        variant: 'info',
        icon: <Clock size={16} />,
        message: `Membership period ended for ${m.orgName ?? 'your organization'} — renewal invoice pending`,
        action: orgId ? { label: 'View status', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
      })
    } else if (daysLeft > 0 && daysLeft <= 30) {
      alerts.push({
        priority: 3,
        variant: 'warning',
        icon: <Clock size={16} />,
        message: `Dues expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} for ${m.orgName ?? 'your organization'}`,
        action: orgId ? { label: 'Renew now', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
      })
    } else if (daysLeft > 30 && daysLeft <= 60) {
      alerts.push({
        priority: 5,
        variant: 'info',
        icon: <Clock size={16} />,
        message: `Dues expire in ${daysLeft} days for ${m.orgName ?? 'your organization'}`,
        action: orgId ? { label: 'View dues', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
      })
    }
  }

  // Check active elections — where voting is actually open
  const activeElections = elections.filter((e) => {
    if (e.status !== 'active' && e.status !== 'voting_open') return false
    const votingStart = e.votingStart ? new Date(e.votingStart) : null
    const votingEnd = e.votingEnd ? new Date(e.votingEnd) : null
    // For voting_open status, trust the status even without date range
    if (e.status === 'voting_open') return true
    return votingStart && votingEnd && votingStart <= now && votingEnd > now
  })
  const topElection = activeElections[0]
  if (topElection) {
    const votingEnd = topElection.votingEnd ? new Date(topElection.votingEnd) : null
    const daysLeft = votingEnd ? Math.ceil((votingEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
    alerts.push({
      priority: 4,
      variant: 'info',
      icon: <Vote size={16} />,
      message: daysLeft
        ? `Vote now — "${topElection.title}" closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
        : `Vote now — "${topElection.title}"`,
      action: topElection.organizationId && topElection.id
        ? { label: 'Vote', to: '/org/$orgSlug/elections/$electionId/vote', params: { orgSlug: topElection.organizationId, electionId: topElection.id } }
        : topElection.organizationId
        ? { label: 'Vote', to: '/org/$orgSlug/elections', params: { orgSlug: topElection.organizationId } }
        : undefined,
    })
  }

  // Check pending payment invoices
  const pendingInvoices = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'generated')
  if (pendingInvoices.length > 0 && overdueInvoices.length === 0) {
    const orgId = pendingInvoices[0]?.organizationId
    alerts.push({
      priority: 6,
      variant: 'info',
      icon: <FileCheck size={16} />,
      message: `${pendingInvoices.length} pending invoice${pendingInvoices.length > 1 ? 's' : ''} awaiting payment`,
      action: orgId ? { label: 'Pay dues', to: '/org/$orgSlug/dues', params: { orgSlug: orgId } } : undefined,
    })
  }

  if (alerts.length === 0) return null

  // Show highest-priority alert
  const sorted = alerts.sort((a, b) => a.priority - b.priority)
  const alert = sorted[0]
  if (!alert) return null

  const variantStyles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 mb-6 ${variantStyles[alert.variant]}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        <span className="shrink-0" aria-hidden="true">{alert.icon}</span>
        <p className="text-[13px] font-semibold">{alert.message}</p>
      </div>
      {alert.action && (
        <Link
          to={alert.action.to}
          params={alert.action.params ?? {}}
          className="shrink-0 text-[12px] font-bold underline underline-offset-2 hover:no-underline"
        >
          {alert.action.label}
        </Link>
      )}
    </div>
  )
}
