import { createFileRoute } from '@tanstack/react-router'
import { DocumentBrowser } from '@/features/documents/components/document-browser'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/documents/')({
  component: MemberDocumentsPage,
})

function MemberDocumentsPage() {
  const { orgId } = useOrg()

  return (
    <PageShell
      title="Documents"
      subtitle="Browse organization documents, bylaws, and forms"
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Documents' },
      ]}
    >
      <div className="space-y-6">
        <GlassCard className="p-6">
          <DocumentBrowser orgId={orgId} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
