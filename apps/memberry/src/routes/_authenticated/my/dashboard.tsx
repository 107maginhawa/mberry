import { createFileRoute } from '@tanstack/react-router'
import { MemberDashboard } from '@/features/dashboard/components/member-dashboard'

export const Route = createFileRoute('/_authenticated/my/dashboard')({
  component: MemberDashboardPage,
})

function MemberDashboardPage() {
  return <MemberDashboard />
}
