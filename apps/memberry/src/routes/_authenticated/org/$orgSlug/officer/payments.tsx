// ui-c-exempt: full-height-layout — officer payments inside officer-shell
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/payments')({
  component: () => <Outlet />,
})
