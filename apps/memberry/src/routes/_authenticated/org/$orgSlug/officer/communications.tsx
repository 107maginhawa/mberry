import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/communications')({
  component: () => <Outlet />,
})
