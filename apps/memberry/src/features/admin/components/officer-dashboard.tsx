import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import {
  Users,
  UserMinus,
  TrendingUp,
  CalendarDays,
  Bell,
  ClipboardList,
  Vote,
  FileText,
  CreditCard,
  Megaphone,
  BarChart3,
  Upload,
  UserPlus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { PageHeader } from '@/components/patterns/page-header'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import {
  listElectionsOptions,
  searchDocumentsOptions,
  searchEventsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import { DashboardKpiCard } from './dashboard/dashboard-kpi-card'
import { ModuleSummaryCard } from './dashboard/module-summary-card'
import { ActionQueue, type ActionItem } from './dashboard/action-queue'
import { Button } from '@monobase/ui'
import { Link } from '@tanstack/react-router'

interface OfficerDashboardProps {
  orgId: string
}

interface MemberSummary {
  activeCount: number
  graceCount: number
  lapsedCount: number
  pendingCount: number
  totalCount: number
  expiringIn30Days: number
}

interface DuesDashboard {
  collectionRate: number
  upcomingActivities: number
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function OfficerDashboard({ orgId }: OfficerDashboardProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  const members = useQuery<MemberSummary>({
    queryKey: ['member-summary', orgId],
    queryFn: async () => {
      const json = await api.get<any>(`/api/membership/members/${orgId}?limit=9999`)
      const all = json.data ?? []
      const counts = { activeCount: 0, graceCount: 0, lapsedCount: 0, pendingCount: 0, totalCount: 0, expiringIn30Days: 0 }
      for (const m of all) {
        counts.totalCount++
        if (m.status === 'active') counts.activeCount++
        else if (m.status === 'gracePeriod') counts.graceCount++
        else if (m.status === 'lapsed') counts.lapsedCount++
        else if (m.status === 'pendingPayment') counts.pendingCount++
        if (m.duesExpiryDate) {
          const expiry = new Date(m.duesExpiryDate)
          const daysLeft = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          if (daysLeft >= 0 && daysLeft <= 30) counts.expiringIn30Days++
        }
      }
      return counts
    },
    retry: false,
  })

  const applications = useQuery<{ pendingCount: number }>({
    queryKey: ['applications-summary', orgId],
    queryFn: async () => {
      const json = await api.get<any>(`/api/membership/applications/${orgId}?status=submitted`)
      const apps = json.data ?? []
      return { pendingCount: apps.length }
    },
    retry: false,
  })

  const dues = useQuery<DuesDashboard>({
    queryKey: ['dues-dashboard', orgId],
    queryFn: async () => {
      const json = await api.get<any>(`/api/dues/dashboard/${orgId}`)
      return json.data ?? { collectionRate: 0, upcomingActivities: 0 }
    },
    retry: false,
  })

  const elections = useQuery(
    listElectionsOptions({ query: { organizationId: orgId } }),
  )

  const documents = useQuery(
    searchDocumentsOptions({ query: { ownerId: orgId, ownerType: 'organization' } }),
  )

  const events = useQuery(
    searchEventsOptions({ query: { organizationId: orgId, limit: 20 } }),
  )

  // Derived data
  const activeElections = (elections.data?.data ?? []).filter(
    (e) => ['nominationsOpen', 'votingOpen', 'awaitingConfirmation'].includes(e.status),
  )
  const activeElectionsCount = activeElections.length

  const draftDocumentsCount = (documents.data?.data ?? []).filter(
    (d) => !d.currentVersionId,
  ).length

  const upcomingEvents = (events.data?.data ?? []).filter((e) => {
    if (!e.startDate) return false
    const start = new Date(e.startDate)
    const daysUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil >= 0
  })
  const upcomingEventsCount = upcomingEvents.length

  const isLoading = members.isLoading || dues.isLoading || applications.isLoading
  const isError = members.isError || dues.isError || applications.isError

  const m = members.data
  const d = dues.data
  const collectionRate = d?.collectionRate ?? 0

  // Zero-data onboarding state
  if (!isLoading && (m?.totalCount ?? 0) === 0) {
    return (
      <div>
        <PageHeader
          title={`${getGreeting()}${firstName ? `, ${firstName}` : ''}`}
          subtitle="Welcome to your association dashboard"
        />
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {/* oli-ui: exempt-icon-size — hero illustration */}
          {/* ui-c-exempt: empty-state-emphasis — no-officers empty hero icon */}
          <Users size={48} className="text-[var(--color-primary-lighter)] mb-4" />
          <h3 className="text-h3 text-[var(--color-primary)]">Get started with your association</h3>
          <p className="text-sm text-[var(--color-muted)] mt-2 max-w-[400px]">
            Import your member roster or add your first member to begin managing your association.
          </p>
          <div className="flex gap-3 mt-6">
            <Link to={`/org/${orgSlug}/officer/roster/import` as any}>
              <Button>
                <Upload size={16} className="mr-2" />
                Import Roster
              </Button>
            </Link>
            <Link to={`/org/${orgSlug}/officer/roster/new` as any}>
              <Button variant="outline">
                <UserPlus size={16} className="mr-2" />
                Add Member
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Build action items with priority tiers
  const actionItems: ActionItem[] = []

  // P0: Grace period members
  if ((m?.graceCount ?? 0) > 0) {
    actionItems.push({
      id: 'grace-members',
      icon: <UserMinus size={20} className="text-[var(--color-error)]" />,
      title: `${m!.graceCount} member${m!.graceCount !== 1 ? 's' : ''} in grace period`,
      description: 'These members are at risk of lapsing — act now',
      href: `/org/${orgSlug}/officer/roster?status=grace`,
      priority: 0,
      variant: 'error',
    })
  }

  // P0: Very low collection rate
  if (collectionRate > 0 && collectionRate < 50) {
    actionItems.push({
      id: 'critical-collection',
      icon: <TrendingUp size={20} className="text-[var(--color-error)]" />,
      title: `Collection rate is ${collectionRate}%`,
      description: 'Critical — review outstanding dues immediately',
      href: `/org/${orgSlug}/officer/payments`,
      priority: 0,
      variant: 'error',
    })
  }

  // P1: Expiring dues
  if ((m?.expiringIn30Days ?? 0) > 0) {
    actionItems.push({
      id: 'expiring-dues',
      icon: <Bell size={20} className="text-[var(--color-warning)]" />,
      title: `${m!.expiringIn30Days} member${m!.expiringIn30Days !== 1 ? 's' : ''} with expiring dues`,
      description: 'Send renewal reminders before they lapse',
      href: `/org/${orgSlug}/officer/roster?status=active&expiring=30`,
      priority: 1,
      variant: 'warning',
    })
  }

  // P1: Pending applications
  if ((applications.data?.pendingCount ?? 0) > 0) {
    actionItems.push({
      id: 'pending-apps',
      icon: <ClipboardList size={20} className="text-[var(--color-warning)]" />,
      title: `${applications.data!.pendingCount} pending application${applications.data!.pendingCount !== 1 ? 's' : ''}`,
      description: 'Review and approve membership applications',
      href: `/org/${orgSlug}/officer/applications`,
      priority: 1,
      variant: 'warning',
    })
  }

  // P1: Low collection rate (50-70%)
  if (collectionRate >= 50 && collectionRate < 70) {
    actionItems.push({
      id: 'low-collection',
      icon: <TrendingUp size={20} className="text-[var(--color-warning)]" />,
      title: `Collection rate is ${collectionRate}%`,
      description: 'Review outstanding dues and follow up with members',
      href: `/org/${orgSlug}/officer/payments`,
      priority: 1,
      variant: 'warning',
    })
  }

  // P1: Election nominations closing
  const nominationsOpen = activeElections.filter((e) => e.status === 'nominationsOpen')
  if (nominationsOpen.length > 0) {
    actionItems.push({
      id: 'nominations-open',
      icon: <Vote size={20} className="text-[var(--color-warning)]" />,
      title: `${nominationsOpen.length} election${nominationsOpen.length !== 1 ? 's' : ''} accepting nominations`,
      description: 'Review nominations before voting begins',
      href: `/org/${orgSlug}/officer/elections`,
      priority: 1,
      variant: 'warning',
    })
  }

  // P2: Election voting open
  const votingOpen = activeElections.filter((e) => e.status === 'votingOpen')
  if (votingOpen.length > 0) {
    actionItems.push({
      id: 'voting-open',
      icon: <Vote size={20} className="text-[var(--color-info)]" />,
      title: `${votingOpen.length} election${votingOpen.length !== 1 ? 's' : ''} in voting`,
      description: 'Voting is active — monitor participation',
      href: `/org/${orgSlug}/officer/elections`,
      priority: 2,
      variant: 'info',
    })
  }

  // P2: Draft documents unpublished
  if (draftDocumentsCount > 0) {
    actionItems.push({
      id: 'draft-docs',
      icon: <FileText size={20} className="text-[var(--color-info)]" />,
      title: `${draftDocumentsCount} draft document${draftDocumentsCount !== 1 ? 's' : ''} unpublished`,
      description: 'Review and publish when ready',
      href: `/org/${orgSlug}/officer/documents`,
      priority: 2,
      variant: 'info',
    })
  }

  // KPI status helpers
  const graceStatus = (m?.graceCount ?? 0) > 0 ? 'warning' as const : 'ok' as const
  const lapsedStatus = (m?.lapsedCount ?? 0) > 0 ? 'error' as const : 'ok' as const
  const collectionStatus = collectionRate < 50 ? 'error' as const : collectionRate < 70 ? 'warning' as const : 'ok' as const
  const electionsStatus = activeElectionsCount > 0 ? 'info' as const : 'ok' as const

  // Module health
  const memberHealth = (m?.graceCount ?? 0) + (m?.lapsedCount ?? 0) > (m?.totalCount ?? 1) * 0.2 ? 'critical' as const
    : (m?.graceCount ?? 0) + (m?.lapsedCount ?? 0) > 0 ? 'attention' as const : 'healthy' as const
  const financeHealth = collectionRate < 50 ? 'critical' as const : collectionRate < 70 ? 'attention' as const : 'healthy' as const
  const electionsHealth = activeElectionsCount > 0 ? 'attention' as const : 'healthy' as const
  const documentsHealth = draftDocumentsCount > 0 ? 'attention' as const : 'healthy' as const

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle="Membership health and action items at a glance"
      />

      {isError && (
        <div role="alert" aria-live="polite" className="text-sm text-[var(--color-error)] p-4 rounded-xl border border-destructive/20 mb-6">
          Some dashboard data failed to load. Showing partial results.
        </div>
      )}

      {/* KPI Strip — 6 cards */}
      <section className="mb-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Membership health (first 4) */}
            <StaggerItem>
              <DashboardKpiCard
                label="Active Members"
                value={m?.activeCount ?? 0}
                icon={<Users size={12} />}
                href={`/org/${orgSlug}/officer/roster`}
              />
            </StaggerItem>
            <StaggerItem>
              <DashboardKpiCard
                label="Grace Period"
                value={m?.graceCount ?? 0}
                icon={<Bell size={12} />}
                href={`/org/${orgSlug}/officer/roster?status=grace`}
                status={graceStatus}
              />
            </StaggerItem>
            <StaggerItem>
              <DashboardKpiCard
                label="Lapsed"
                value={m?.lapsedCount ?? 0}
                icon={<UserMinus size={12} />}
                href={`/org/${orgSlug}/officer/roster?status=lapsed`}
                status={lapsedStatus}
              />
            </StaggerItem>
            <StaggerItem>
              <DashboardKpiCard
                label="Collection Rate"
                value={collectionRate}
                icon={<TrendingUp size={12} />}
                href={`/org/${orgSlug}/officer/payments`}
                suffix="%"
                status={collectionStatus}
              />
            </StaggerItem>

            {/* Visual gap — operational status (last 2) */}
            <StaggerItem>
              <DashboardKpiCard
                label="Upcoming Events"
                value={upcomingEventsCount}
                icon={<CalendarDays size={12} />}
                href={`/org/${orgSlug}/officer/events`}
              />
            </StaggerItem>
            <StaggerItem>
              <DashboardKpiCard
                label="Active Elections"
                value={activeElectionsCount}
                icon={<Vote size={12} />}
                href={`/org/${orgSlug}/officer/elections`}
                status={electionsStatus}
              />
            </StaggerItem>
          </StaggerGrid>
        )}
      </section>

      {/* Action Queue */}
      {isLoading ? (
        <section className="space-y-3 mb-8">
          <h2 className="text-h4 mb-2">Action Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>
      ) : (
        <div className="mb-8">
          <ActionQueue items={actionItems} />
        </div>
      )}

      {/* Module Summary Cards */}
      <section>
        <h2 className="text-h4 mb-3">Modules</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <StaggerItem>
              <ModuleSummaryCard
                title="Members"
                icon={<Users size={16} />}
                status={memberHealth}
                metric={`${m?.activeCount ?? 0}/${m?.totalCount ?? 0} active`}
                href={`/org/${orgSlug}/officer/roster`}
                secondaryAction={
                  (applications.data?.pendingCount ?? 0) > 0
                    ? { label: `Review ${applications.data!.pendingCount} pending`, href: `/org/${orgSlug}/officer/applications` }
                    : undefined
                }
              />
            </StaggerItem>
            <StaggerItem>
              <ModuleSummaryCard
                title="Finances"
                icon={<CreditCard size={16} />}
                status={financeHealth}
                metric={`${collectionRate}% collected`}
                href={`/org/${orgSlug}/officer/payments`}
              />
            </StaggerItem>
            <StaggerItem>
              <ModuleSummaryCard
                title="Events"
                icon={<CalendarDays size={16} />}
                status="healthy"
                metric={upcomingEventsCount > 0 ? `${upcomingEventsCount} upcoming` : undefined}
                href={`/org/${orgSlug}/officer/events`}
              />
            </StaggerItem>
            <StaggerItem>
              <ModuleSummaryCard
                title="Elections"
                icon={<Vote size={16} />}
                status={electionsHealth}
                metric={activeElectionsCount > 0 ? `${activeElectionsCount} active` : undefined}
                href={`/org/${orgSlug}/officer/elections`}
              />
            </StaggerItem>
            <StaggerItem>
              <ModuleSummaryCard
                title="Documents"
                icon={<FileText size={16} />}
                status={documentsHealth}
                metric={draftDocumentsCount > 0 ? `${draftDocumentsCount} drafts` : undefined}
                href={`/org/${orgSlug}/officer/documents`}
              />
            </StaggerItem>
            <StaggerItem>
              <ModuleSummaryCard
                title="Communications"
                icon={<Megaphone size={16} />}
                status="healthy"
                href={`/org/${orgSlug}/officer/announcements`}
              />
            </StaggerItem>
          </StaggerGrid>
        )}
      </section>
    </div>
  )
}
