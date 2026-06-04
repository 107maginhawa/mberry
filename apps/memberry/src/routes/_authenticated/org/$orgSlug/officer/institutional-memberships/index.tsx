import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { Button } from '@monobase/ui'
import { InstitutionalMembershipTable } from '@/features/membership/components/institutional-membership-table'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/institutional-memberships/')({
  component: InstitutionalMembershipsPage,
})

function InstitutionalMembershipsPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Institutional Memberships"
      subtitle="Manage organizational memberships and seat allocations"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Institutions' },
      ]}
      actions={
        <Button size="sm" asChild>
          <Link to="/org/$orgSlug/officer/institutional-memberships/new" params={{ orgSlug }}>
            <Building2 size={14} className="mr-1.5" />
            New Membership
          </Link>
        </Button>
      }
    >
      <InstitutionalMembershipTable orgId={orgId} />
    </PageShell>
  )
}
