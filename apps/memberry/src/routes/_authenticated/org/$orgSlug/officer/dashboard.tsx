// ui-c-exempt: full-height-layout — officer dashboard rendered inside officer-shell
import { createFileRoute } from '@tanstack/react-router'
import { OfficerDashboard } from '@/features/admin/components/officer-dashboard'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/dashboard')({
  component: OfficerDashboardPage,
})

function OfficerDashboardPage() {
  const { orgId } = useOrg()
  return <OfficerDashboard orgId={orgId} />
}
