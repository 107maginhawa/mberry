// ui-c-exempt: full-height-layout — officer settings-funds inside officer-shell
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/funds')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/org/$orgSlug/officer/finances/funds', params })
  },
  component: () => null,
})
