import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/roster')({
  component: () => <Outlet />,
})
