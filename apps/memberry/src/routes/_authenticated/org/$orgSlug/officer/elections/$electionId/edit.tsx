import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@monobase/ui'
import { getElectionOptions } from '@monobase/sdk-ts/generated/react-query'
import { ElectionForm } from '@/features/elections/components/election-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

/** Runtime election shape from API (SDK Election type has Date fields; runtime uses strings + extra fields) */
interface RuntimeElection {
  id: string
  title: string
  status: string
  type?: string
  votingMode?: string
  passageThreshold?: number | string
  positions?: unknown[]
  nominationStart?: string | null
  nominationEnd?: string | null
  nominationsOpenAt?: string | null
  nominationsCloseAt?: string | null
  votingStart?: string | null
  votingEnd?: string | null
  votingOpenAt?: string | null
  votingCloseAt?: string | null
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/elections/$electionId/edit')({
  component: EditElection,
})

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

function EditElection() {
  const { orgId, orgSlug } = useOrg()
  const { electionId } = Route.useParams()
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  // SDK Election type has Date fields; runtime response has string dates + extra fields — use local RuntimeElection
  const election = data as unknown as RuntimeElection

  if (isError) {
    return (
      <PageShell
        title="Edit Election"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
          { label: 'Edit' },
        ]}
      >
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load election for editing. Please try refreshing the page.
        </div>
      </PageShell>
    )
  }

  if (isLoading) {
    return (
      <PageShell
        title="Edit Election"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
          { label: 'Edit' },
        ]}
      >
        <GlassCard className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </GlassCard>
      </PageShell>
    )
  }

  if (error || !election) {
    return (
      <PageShell
        title="Edit Election"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
          { label: 'Edit' },
        ]}
      >
        <GlassCard className="p-6">
          <div className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
        </GlassCard>
      </PageShell>
    )
  }

  const positions = (election.positions ?? []).map((p: any, i: number) =>
    typeof p === 'string'
      ? { id: p, title: p, sortOrder: i }
      : { id: p.id ?? p, title: p.title ?? `Position ${i + 1}`, sortOrder: p.sortOrder ?? i },
  )

  const initialData = {
    title: election.title ?? '',
    type: (election.type === 'bylaw' ? 'bylaw' : 'officer') as 'officer' | 'bylaw',
    votingMode: (election.votingMode ?? 'online') as 'online' | 'in_person' | 'hybrid',
    passageThreshold: election.passageThreshold ? String(election.passageThreshold) : '',
    nominationsOpenAt: toDatetimeLocal(election.nominationStart ?? election.nominationsOpenAt),
    nominationsCloseAt: toDatetimeLocal(election.nominationEnd ?? election.nominationsCloseAt),
    votingOpenAt: toDatetimeLocal(election.votingStart ?? election.votingOpenAt),
    votingCloseAt: toDatetimeLocal(election.votingEnd ?? election.votingCloseAt),
    positions,
  }

  return (
    <PageShell
      title="Edit Election"
      subtitle={election.title}
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
        { label: 'Edit' },
      ]}
    >
      <GlassCard className="p-6">
        <ElectionForm
          orgId={orgId}
          electionId={electionId}
          initialData={initialData}
          onSuccess={() => {
            navigate({
              to: '/org/$orgSlug/officer/elections/$electionId',
              params: { orgSlug, electionId },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgSlug/officer/elections/$electionId',
              params: { orgSlug, electionId },
            })
          }}
        />
      </GlassCard>
    </PageShell>
  )
}
