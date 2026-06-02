// oli-execute: error-handled-inline
// `error` renders "Failed to load election" branch at ~L71-83. Gate
// heuristic misses the destructured rename.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton, PageContainer } from '@monobase/ui'
import { getElectionOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { ElectionForm } from '@/features/elections/components/election-form'
import { PageHeader } from '@/components/patterns/page-header'
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

  const { data, isLoading, error } = useQuery(
    getElectionOptions({ path: { electionId } }),
  )

  // SDK Election type has Date fields; runtime response has string dates + extra fields — use local RuntimeElection
  const election = data as unknown as RuntimeElection

  if (isLoading) {
    return (
      <PageContainer width="default" className="space-y-6">
        <PageHeader
          title="Edit Election"
          breadcrumbs={[
            { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
            { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
            { label: 'Edit' },
          ]}
        />
        <GlassCard className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </GlassCard>
      </PageContainer>
    )
  }

  if (error || !election) {
    return (
      <PageContainer width="default" className="space-y-6">
        <PageHeader
          title="Edit Election"
          breadcrumbs={[
            { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
            { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
            { label: 'Edit' },
          ]}
        />
        <GlassCard className="p-6">
          <div className="p-6 text-center text-[var(--color-error)]">Failed to load election</div>
        </GlassCard>
      </PageContainer>
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
    <PageContainer width="default" className="space-y-6">
      <PageHeader
        title="Edit Election"
        subtitle={election.title}
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
          { label: 'Edit' },
        ]}
      />

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
    </PageContainer>
  )
}
