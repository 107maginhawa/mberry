import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/compliance/')({
  component: CompliancePage,
})

function CompliancePage() {
  return (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <ClipboardCheck className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-h1 text-foreground">Compliance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor regulatory compliance and reporting
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Compliance monitoring and reporting will be available in a future update.
          </p>
        </div>
      </div>
    </RequireRole>
  )
}
