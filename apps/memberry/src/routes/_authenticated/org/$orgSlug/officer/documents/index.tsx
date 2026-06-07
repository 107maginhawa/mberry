import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { DocumentLibrary } from '@/features/documents/components/document-library'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/documents/')({
  component: OfficerDocuments,
})

function OfficerDocuments() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Document Library"
      subtitle="Manage organization documents, policies, and records"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Documents' },
      ]}
    >
      <DocumentLibrary orgId={orgId} />
    </PageShell>
  )
}
