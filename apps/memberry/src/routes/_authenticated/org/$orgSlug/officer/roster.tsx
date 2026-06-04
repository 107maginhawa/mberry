// ui-c-exempt: full-height-layout — officer roster rendered inside officer-shell
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/roster')({
  component: () => <Outlet />,
})
