import { createFileRoute } from '@tanstack/react-router'
import { DocumentBrowser } from '@/features/documents/components/document-browser'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/documents/')({
  component: MemberDocumentsPage,
})

function MemberDocumentsPage() {
  const { orgId } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Browse organization documents, bylaws, and forms"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Documents' },
        ]}
      />

      <GlassCard className="p-6">
        <DocumentBrowser orgId={orgId} />
      </GlassCard>
    </div>
  )
}
