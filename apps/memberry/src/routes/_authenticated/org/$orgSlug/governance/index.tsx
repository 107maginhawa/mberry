import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Vote, FileText, ChevronRight } from 'lucide-react'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { EmptyState } from '@/components/patterns/empty-state'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { useOrg } from '@/hooks/useOrg'
import {
  listElectionsOptions,
  searchDocumentsOptions,
} from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/governance/')({
  component: GovernancePage,
})

const ACTIVE_ELECTION_STATUSES = ['nominationsOpen', 'votingOpen', 'awaitingConfirmation'] as const

function GovernancePage() {
  const { orgId, orgSlug } = useOrg()

  const elections = useQuery(
    listElectionsOptions({ query: { organizationId: orgId } }),
  )

  const documents = useQuery(
    searchDocumentsOptions({ query: { ownerId: orgId, ownerType: 'organization', limit: 5 } }),
  )

  const allElections = elections.data?.data ?? []
  const activeElections = allElections.filter((e) =>
    (ACTIVE_ELECTION_STATUSES as readonly string[]).includes(e.status),
  )

  const allDocuments = documents.data?.data ?? []

  const isLoading = elections.isLoading || documents.isLoading
  const error = elections.error || documents.error

  return (
    <PageShell
      title="Governance"
      subtitle="Your governance hub"
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Governance' },
      ]}
    >
      <div className="space-y-6">
      {error ? (
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load governance data. Please try refreshing the page.
        </div>
      ) : (
        <>
      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <StaggerGrid className="grid grid-cols-2 gap-4">
          <StaggerItem>
            <GlassCard className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Vote size={20} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Active Elections</p>
                <p className="text-[28px] font-bold font-display mt-0.5">
                  <CountUp value={activeElections.length} />
                </p>
              </div>
            </GlassCard>
          </StaggerItem>
          <StaggerItem>
            <GlassCard className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-info)]/10 flex items-center justify-center shrink-0">
                <FileText size={20} className="text-[var(--color-info)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Documents</p>
                <p className="text-[28px] font-bold font-display mt-0.5">
                  <CountUp value={allDocuments.length} />
                </p>
              </div>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>
      )}

      {/* Active Elections */}
      <section>
        <h2 className="text-h4 mb-3">Active Elections</h2>
        {elections.isLoading ? (
          <div className="space-y-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : activeElections.length === 0 ? (
          // ui-c-exempt: empty-state-emphasis — no-elections EmptyState
          <EmptyState
            icon={<Vote size={32} />}
            headline="No active elections"
            description="When officers open an election, it will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activeElections.map((election) => (
              <Link
                key={election.id}
                // Dynamic org-scoped href — route registry can't infer this shape
                to={`/org/${orgSlug}/elections/${election.id}` as any /* eslint-disable-line @typescript-eslint/no-explicit-any */}
                className="block"
              >
                <GlassCard className="p-4 hover:shadow-soft transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Vote size={16} className="text-[var(--color-primary)] shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{election.title}</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5 capitalize">
                          {election.status.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--color-muted)]" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Documents */}
      <section>
        <h2 className="text-h4 mb-3">Recent Documents</h2>
        {documents.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : allDocuments.length === 0 ? (
          // ui-c-exempt: empty-state-emphasis — no-decisions EmptyState
          <EmptyState
            icon={<FileText size={32} />}
            headline="No documents published yet"
            description="Bylaws, minutes, and other published documents will appear here."
          />
        ) : (
          <div className="space-y-2">
            {allDocuments.map((doc) => (
              <Link
                key={doc.id}
                // Dynamic org-scoped href — route registry can't infer this shape
                to={`/org/${orgSlug}/documents/${doc.id}` as any /* eslint-disable-line @typescript-eslint/no-explicit-any */}
                className="block"
              >
                <GlassCard className="p-4 hover:shadow-soft transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-[var(--color-info)] shrink-0" />
                      <p className="text-sm font-semibold">{doc.title}</p>
                    </div>
                    <ChevronRight size={16} className="text-[var(--color-muted)]" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
        </>
      )}
      </div>
    </PageShell>
  )
}
