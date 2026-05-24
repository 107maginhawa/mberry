import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/dues/treasurer')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/org/$orgSlug/officer/finances', params })
  },
  component: () => null,
})
