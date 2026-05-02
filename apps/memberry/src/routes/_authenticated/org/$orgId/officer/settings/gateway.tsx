import { createFileRoute } from '@tanstack/react-router'
import { GatewaySetup } from '@/features/dues/components/gateway-setup'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/gateway')({
  component: GatewaySettingsPage,
})

function GatewaySettingsPage() {
  const { orgId } = Route.useParams()

  // Desktop only — gateway config should not be done on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Desktop Only</h1>
        <p className="text-muted-foreground">
          This page is only available on desktop. Please use a larger screen to configure payment
          gateway settings.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Payment Gateway</h1>
      <GatewaySetup orgId={orgId} />
    </div>
  )
}
