import { createFileRoute } from '@tanstack/react-router'
import { DataExport } from '@/features/account/components/data-export'
import { PageShell } from '@/components/patterns/page-shell'

export const Route = createFileRoute('/_authenticated/my/data-export')({
  component: DataExportPage,
})

function DataExportPage() {
  return (
    <PageShell
      title="Export My Data"
      subtitle="Download a copy of your personal data"
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Data Export' },
      ]}
      maxWidth="narrow"
    >
      <DataExport />
    </PageShell>
  )
}
