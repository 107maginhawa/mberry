import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/invoices')({
  component: InvoicesPage,
})

function InvoicesPage() {
  const { orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Track and manage dues invoices"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Invoices' },
        ]}
      />

      {/* Tab filters and invoice table will be built in Phase 3 */}
      <GlassCard className="p-5">
        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1.5 rounded-md bg-[var(--color-primary)]/10 text-sm font-medium">All</span>
          <span className="px-3 py-1.5 rounded-md text-sm text-[var(--color-muted)]">Draft</span>
          <span className="px-3 py-1.5 rounded-md text-sm text-[var(--color-muted)]">Open</span>
          <span className="px-3 py-1.5 rounded-md text-sm text-[var(--color-muted)]">Past Due</span>
          <span className="px-3 py-1.5 rounded-md text-sm text-[var(--color-muted)]">Paid</span>
        </div>
        <div className="h-64 flex items-center justify-center text-[var(--color-muted)] text-sm">
          Invoice list with tab filters, search, and bulk actions will be built in Phase 3
        </div>
      </GlassCard>
    </div>
  )
}
