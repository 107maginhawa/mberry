import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/compliance/')({
  component: CompliancePage,
})

function CompliancePage() {
  return (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <PageShell
        title="Compliance"
        subtitle="Monitor regulatory compliance and reporting"
      >
        <div className="rounded-lg border bg-card p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Compliance monitoring and reporting will be available in a future update.
          </p>
        </div>
      </PageShell>
    </RequireRole>
  )
}
