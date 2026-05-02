import { createFileRoute } from '@tanstack/react-router'
import { DataExport } from '@/features/account/components/data-export'

export const Route = createFileRoute('/_authenticated/my/data-export')({
  component: DataExportPage,
})

function DataExportPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Export My Data</h1>
      <DataExport />
    </div>
  )
}
