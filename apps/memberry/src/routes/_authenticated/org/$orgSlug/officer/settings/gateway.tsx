import { createFileRoute } from '@tanstack/react-router'
import { GatewaySetup } from '@/features/dues/components/gateway-setup'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/gateway')({
  component: GatewaySettingsPage,
})

function GatewaySettingsPage() {
  const { orgId, orgSlug } = useOrg()

  // Desktop only — gateway config should not be done on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payment Gateway"
          subtitle="Configure payment processing"
          breadcrumbs={[
            { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
            { label: 'Settings' },
            { label: 'Gateway' },
          ]}
        />
        <GlassCard className="p-6 text-center">
          <h2 className="text-h3 mb-2">Desktop Only</h2>
          <p className="text-sm text-[var(--color-muted)]">
            This page is only available on desktop. Please use a larger screen to configure payment
            gateway settings.
          </p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Gateway"
        subtitle="Configure payment processing"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Gateway' },
        ]}
      />
      <GlassCard className="p-6">
        <GatewaySetup orgId={orgId} />
      </GlassCard>
    </div>
  )
}
