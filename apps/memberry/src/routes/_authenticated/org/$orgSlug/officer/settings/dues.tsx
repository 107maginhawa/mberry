import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/dues')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/org/$orgSlug/officer/finances/dues', params })
  },
  component: () => null,
})
