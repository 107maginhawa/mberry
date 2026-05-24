import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { DocumentLibrary } from '@/features/documents/components/document-library'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/documents/')({
  component: OfficerDocuments,
})

function OfficerDocuments() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Library"
        subtitle="Manage organization documents, policies, and records"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Documents' },
        ]}
      />

      <DocumentLibrary orgId={orgId} />
    </div>
  )
}
