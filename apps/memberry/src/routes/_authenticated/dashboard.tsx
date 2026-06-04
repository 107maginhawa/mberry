import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  getPersonOptions,
  listMyCustomEventsOptions,
  listElectionsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { StatusBadge } from '@/components/patterns/status-badge'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { Calendar, Award, Shield, UserPlus, CreditCard, CircleDot } from 'lucide-react'
import { Progress } from '@monobase/ui'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'

import { AlertBanner } from '@/features/dashboard/components/alert-banner'
import { ActionWidget, CreditRing } from '@/features/dashboard/components/action-widget'
import { OrgAnnouncements } from '@/features/dashboard/components/org-announcements'
import { CreditBreakdown } from '@/features/dashboard/components/credit-breakdown'
import { QuickActions } from '@/features/dashboard/components/quick-actions'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function DashboardPage() {
  const navigate = useNavigate()
  const person = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    retry: false,
  })

  const membershipsQuery = useQuery<any[]>({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const res = await api.get<any>('/api/persons/me/memberships')
      return res?.data || []
    },
    retry: false,
  })

  const eventsQuery = useQuery({
    ...listMyCustomEventsOptions({ query: { limit: 10 } }),
    select: (res: any) => {
      const now = new Date()
      const items = (res?.data || []).map((e: any) => e.event || e)
      return items
        .filter((e: any) => new Date(e.startDate || e.start_date) >= now)
        .sort((a: any, b: any) => new Date(a.startDate || a.start_date).getTime() - new Date(b.startDate || b.start_date).getTime())
        .slice(0, 5)
    },
    retry: false,
  })

  const memberships = membershipsQuery.data ?? []

  // Build org ID → name map (needed before queries that depend on org context)
  const orgNames: Record<string, string> = {}
  for (const m of memberships) {
    const oid = m.orgId ?? m.organizationId
    if (oid && m.orgName) orgNames[oid] = m.orgName
  }
  const orgIds = Object.keys(orgNames)
  const firstOrgId = orgIds[0]

  const creditSummaryQuery = useQuery({
    queryKey: ['credit-summary'],
    queryFn: () => api.get<{ totalCredits?: number; totalEarned?: number; requiredCredits?: number; remaining?: number }>('/api/persons/me/credit-summary'),
    retry: false,
  })

  const invoicesQuery = useQuery<{ data: any[] }>({
    queryKey: ['my-dues-invoices', orgIds],
    queryFn: async () => {
      const all: any[] = []
      for (const oid of orgIds) {
        try {
          const res = await api.get<any>(`/api/association/member/dues-invoices?organizationId=${oid}&limit=10`)
          const items = res?.data ?? []
          all.push(...items)
        } catch { /* member may not have admin access or org has no dues */ }
      }
      return { data: all }
    },
    retry: false,
    enabled: orgIds.length > 0,
  })

  const electionsQuery = useQuery({
    ...listElectionsOptions({
      query: { limit: 10 },
      headers: firstOrgId ? { 'x-org-id': firstOrgId } : undefined,
    }),
    retry: false,
    enabled: !!firstOrgId,
  })
  const announcementsQuery = useQuery<any[]>({
    queryKey: ['dashboard-announcements', firstOrgId],
    queryFn: async () => {
      if (!firstOrgId) return []
      const res = await api.get<any>(`/api/communications/announcements/${firstOrgId}?status=sent&limit=5`)
      return res?.data || []
    },
    retry: false,
    enabled: !!firstOrgId,
  })

  // Fetch compliance for first org (API is per-org)
  const complianceQuery = useQuery<any>({
    queryKey: ['dashboard-compliance', firstOrgId],
    queryFn: async () => {
      if (!firstOrgId) return null
      const res = await api.get<any>(`/api/credit-compliance/${firstOrgId}`)
      return res
    },
    retry: false,
    enabled: !!firstOrgId,
  })

  // Derived data
  const upcomingEvents = eventsQuery.data ?? []
  const creditData = creditSummaryQuery.data
  const totalCredits = creditData?.totalCredits ?? creditData?.totalEarned ?? 0
  const invoices: any[] = invoicesQuery.data?.data ?? []
  const elections = (electionsQuery.data?.data ?? []) as unknown as Array<{ id?: string; title?: string; status?: string; votingStart?: string; votingEnd?: string; organizationId?: string }>
  const announcements = announcementsQuery.data ?? []

  // Compliance — use snake_case fields matching API response
  const complianceData = complianceQuery.data
  const requiredCredits = complianceData?.summary?.requiredCredits ?? creditData?.requiredCredits ?? 0
  const personId = person.data?.id
  const myCompliance = complianceData?.data?.find?.((r: any) =>
    (r.person_id === personId) || (r.personId === personId)
  )
  const myEarned = (myCompliance?.earned != null && myCompliance.earned > 0) ? myCompliance.earned : totalCredits
  const myRequired = (myCompliance?.required != null && myCompliance.required > 0) ? myCompliance.required : requiredCredits

  // Derive compliance status from snake_case field or compute
  let complianceStatus: 'compliant' | 'atRisk' | 'nonCompliant' | undefined
  if (myCompliance) {
    const raw = myCompliance.compliance_status ?? myCompliance.complianceStatus
    if (raw === 'compliant') complianceStatus = 'compliant'
    else if (raw === 'at_risk' || raw === 'atRisk') complianceStatus = 'atRisk'
    else if (raw === 'non_compliant' || raw === 'nonCompliant') complianceStatus = 'nonCompliant'
  } else if (myRequired > 0) {
    complianceStatus = myEarned >= myRequired ? 'compliant' : myEarned >= myRequired * 0.5 ? 'atRisk' : 'nonCompliant'
  }

  // Dues — aggregate across all orgs
  const unpaidInvoices = invoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'writtenOff')
  const overdueInvoices = invoices.filter((inv: any) => inv.status === 'overdue')
  const nextDueInvoice = unpaidInvoices[0]

  // Build orgId → slug lookup for navigation
  const orgIdToSlug: Record<string, string> = {}
  for (const m of memberships) {
    const oid = m.orgId ?? m.organizationId
    if (oid && m.orgSlug) orgIdToSlug[oid] = m.orgSlug
  }

  // Smart org routing for quick actions: org with unpaid dues first, else first org
  const duesOrgId = nextDueInvoice?.organizationId ?? undefined
  const duesOrgSlug = duesOrgId ? orgIdToSlug[duesOrgId] : undefined
  const firstOrgSlug = firstOrgId ? orgIdToSlug[firstOrgId] : undefined
  const eventsOrgId = firstOrgId

  const { user } = Route.useRouteContext()
  const displayName = person.data?.firstName ?? user?.name?.split(' ')[0] ?? 'there'

  // Next event
  const nextEvent = upcomingEvents[0]
  const nextEventDays = nextEvent
    ? Math.ceil((new Date(nextEvent.startDate || nextEvent.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // CPD status label for merged widget
  const cpdStatusLabel = complianceStatus === 'compliant'
    ? 'Good Standing'
    : complianceStatus === 'atRisk'
      ? 'At Risk'
      : complianceStatus === 'nonCompliant'
        ? 'Needs Attention'
        : undefined

  return (
    <PageShell
      title={`${getGreeting()}, ${displayName}`}
      subtitle="Your membership health at a glance"
    >
      <div className="space-y-6">
      {/* Alert Banner */}
      <AlertBanner
        memberships={memberships}
        invoices={invoices}
        elections={elections}
      />

      {/* Onboarding prompt */}
      {person.data && !person.data.specialization && (
        <Link
          to="/onboarding"
          className="block rounded-[12px] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] shadow-[var(--shadow-soft)] p-4 hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Complete your profile</p>
              <p className="text-sm font-medium text-[var(--color-muted)]">Add your specialization and preferences</p>
            </div>
          </div>
        </Link>
      )}

      {/* Org Membership Cards */}
      <section>
        <h2 className="text-h4 mb-4">Your Organizations</h2>
        {membershipsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !memberships.length ? (
          <EmptyState
            headline="No memberships yet"
            description="Join an organization to get started"
            action={{ label: 'Find Organizations', onClick: () => navigate({ to: '/my/organizations' }) }}
          />
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {memberships.map((m: any) => (
              <StaggerItem key={m.id}>
                <OrgCard membership={m} invoices={invoices} />
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </section>

      {/* Action Widgets */}
      <section>
        <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StaggerItem>
          <ActionWidget
            icon={<CreditCard size={16} />}
            label="Dues"
            value={unpaidInvoices.length > 0 ? `₱${Number(nextDueInvoice?.totalAmount || 0).toLocaleString()}` : 'Paid'}
            subtitle={unpaidInvoices.length > 0
              ? `${overdueInvoices.length > 0 ? 'Overdue' : 'Due'} — ${nextDueInvoice?.invoiceNumber || ''}`
              : 'All dues current'
            }
            status={unpaidInvoices.length > 0 ? (overdueInvoices.length > 0 ? 'error' : 'warning') : 'success'}
            statusLabel={unpaidInvoices.length > 0 ? (overdueInvoices.length > 0 ? 'Overdue' : 'Payment due') : 'All paid'}
            errorMessage={invoicesQuery.isError ? 'Unable to load dues status' : undefined}
            action={duesOrgSlug
              ? { label: unpaidInvoices.length > 0 ? 'Pay now' : 'View dues', to: '/org/$orgSlug/dues', params: { orgSlug: duesOrgSlug } }
              : firstOrgSlug
                ? { label: 'View dues', to: '/org/$orgSlug/dues', params: { orgSlug: firstOrgSlug } }
                : undefined
            }
          />
          </StaggerItem>

          {/* CPD Status — merged credits + compliance */}
          <StaggerItem>
          <ActionWidget
            icon={<Award size={16} />}
            label="CPD Status"
            value=""
            status={complianceStatus === 'compliant' ? 'success' : complianceStatus === 'atRisk' ? 'warning' : complianceStatus === 'nonCompliant' ? 'error' : undefined}
            statusLabel={cpdStatusLabel}
            errorMessage={creditSummaryQuery.isError ? 'Unable to load credit data' : undefined}
            action={{ label: 'View credits', to: '/my/credits' }}
          >
            <div className="flex items-center gap-3">
              {/* ui-c-exempt: custom-component-prop — CreditRing size prop is component scalar, not Icon */}
              <CreditRing earned={myEarned} required={myRequired || myEarned} size={44} />
              <div>
                <p className="text-xl font-bold font-display text-[var(--color-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <CountUp value={myEarned} />
                  {myRequired > 0 && (
                    <span className="text-sm font-medium text-[var(--color-muted)]">/<CountUp value={myRequired} /></span>
                  )}
                </p>
                <p className="text-xs font-medium text-[var(--color-muted)]">
                  {cpdStatusLabel
                    ? cpdStatusLabel
                    : myRequired > 0 && myEarned < myRequired
                      ? `${myRequired - myEarned} more needed`
                      : 'CPD credits'
                  }
                </p>
              </div>
            </div>
          </ActionWidget>
          </StaggerItem>

          {/* Next Event */}
          <StaggerItem>
          <ActionWidget
            icon={<Calendar size={16} />}
            label="Next Event"
            value={nextEvent ? (nextEvent.title || nextEvent.name) : 'None'}
            subtitle={nextEventDays !== null
              ? nextEventDays === 0 ? 'Today' : nextEventDays === 1 ? 'Tomorrow' : `In ${nextEventDays} days`
              : 'No upcoming events'
            }
            status={nextEvent ? 'neutral' : undefined}
            action={{ label: 'View events', to: '/my/events' }}
          />
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* Quick Actions */}
      <QuickActions
        duesOrgSlug={duesOrgSlug}
        eventsOrgSlug={firstOrgSlug}
      />

      {/* Org News + Credit Progress */}
      <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StaggerItem>
          <OrgAnnouncements
            announcements={announcements}
            orgNames={orgNames}
            isError={announcementsQuery.isError}
          />
        </StaggerItem>
        <StaggerItem>
          <CreditBreakdown
            totalCredits={totalCredits}
            requiredCredits={requiredCredits}
            isError={creditSummaryQuery.isError}
          />
        </StaggerItem>
      </StaggerGrid>
      </div>
    </PageShell>
  )
}

function OrgCard({ membership: m, invoices }: { membership: any; invoices: any[] }) {
  const orgId = m.orgId ?? m.organizationId
  const orgSlug = m.orgSlug || ''
  const officerQuery = useQuery<string | null>({
    queryKey: ['officer-role', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const json = await api.get<any>(`/api/persons/me/officer-role/${orgId}`)
      const positions = Array.isArray(json?.data) ? json.data : []
      if (positions.length > 0) {
        return positions[0]?.positionTitle || 'Officer'
      }
      return null
    },
    retry: false,
    enabled: !!orgId,
  })

  const officerRole = officerQuery.data ?? null

  // Calculate dues period progress
  const now = new Date()
  const expiryDate = m.duesExpiryDate ? new Date(m.duesExpiryDate) : null
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  // Estimate period progress (assume 12-month cycle)
  const periodMonths = 12
  const periodProgress = expiryDate
    ? Math.max(0, Math.min(1, 1 - (daysLeft ?? 0) / (periodMonths * 30.44)))
    : 0

  // Org-specific invoice status
  const orgInvoices = invoices.filter((inv: any) => inv.organizationId === orgId)
  const hasOrgUnpaid = orgInvoices.some((inv: any) => inv.status === 'overdue' || inv.status === 'sent' || inv.status === 'generated')

  // Standing indicator
  const standing: 'good' | 'warning' | 'poor' =
    orgInvoices.some((inv: any) => inv.status === 'overdue') ? 'poor' :
    hasOrgUnpaid ? 'warning' : 'good'

  const standingColors = {
    good: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    poor: 'bg-[var(--color-error)]',
  }

  const standingLabels = {
    good: 'Good standing',
    warning: 'Payment due',
    poor: 'Overdue',
  }

  return (
    <GlassCard className="p-5">
      <Link
        to="/org/$orgSlug/home"
        params={{ orgSlug }}
        className="block hover:opacity-80 transition-opacity"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AvatarInitials name={m.orgName ?? 'Org'} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{m.orgName}</p>
                <span
                  className={`w-2 h-2 rounded-full ${standingColors[standing]}`}
                  role="img"
                  aria-label={standingLabels[standing]}
                />
              </div>
              {m.memberNumber && (
                <p className="text-sm font-medium text-[var(--color-muted)]">#{m.memberNumber}</p>
              )}
            </div>
          </div>
          <StatusBadge status={m.status ?? 'pending'} />
        </div>

        {/* Dues period progress bar */}
        {expiryDate && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-[var(--color-muted)]">
                {daysLeft !== null && daysLeft > 0
                  ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                  : daysLeft !== null && daysLeft <= 0
                    ? 'Expired'
                    : ''
                }
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Expires {expiryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Progress
              value={Math.min(100, periodProgress * 100)}
              className={`h-1.5 bg-[var(--color-border-light)] ${
                (daysLeft ?? 0) <= 0 ? '[&>div]:bg-[var(--color-error)]' :
                (daysLeft ?? 0) <= 30 ? '[&>div]:bg-[var(--color-warning)]' : '[&>div]:bg-[var(--color-success)]'
              }`}
            />
          </div>
        )}
      </Link>

      {/* Quick action row */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center gap-2 flex-wrap">
        {hasOrgUnpaid && orgId && (
          <Link
            to="/org/$orgSlug/dues"
            params={{ orgSlug }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <CreditCard size={12} aria-hidden="true" />
            Pay Dues
          </Link>
        )}
        {orgId && (
          <Link
            to="/my/id-card"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:underline"
          >
            <CircleDot size={12} aria-hidden="true" />
            ID Card
          </Link>
        )}
        {officerRole && (
          <Link
            to="/org/$orgSlug/officer/dashboard"
            params={{ orgSlug }}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <Shield size={12} aria-hidden="true" />
            {officerRole} Dashboard
          </Link>
        )}
      </div>
    </GlassCard>
  )
}
