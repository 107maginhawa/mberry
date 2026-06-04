import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/verifications/')({
  component: VerificationsPage,
})

function VerificationsPage() {
  return (
    <RequireRole allowed={['super', 'support']}>
      <PageShell
        title="Verifications"
        subtitle="Review and manage member credential verifications"
      >
        <div className="rounded-lg border bg-card p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Credential verification management will be available in a future update.
          </p>
        </div>
      </PageShell>
    </RequireRole>
  )
}
