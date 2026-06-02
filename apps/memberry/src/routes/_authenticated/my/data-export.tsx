import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '@monobase/ui'
import { DataExport } from '@/features/account/components/data-export'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/my/data-export')({
  component: DataExportPage,
})

function DataExportPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Export My Data"
        subtitle="Download a copy of your personal data"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Data Export' },
        ]}
      />
      <DataExport />
    </PageContainer>
  )
}
