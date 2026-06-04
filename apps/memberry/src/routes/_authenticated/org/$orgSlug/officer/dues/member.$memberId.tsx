import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/dues/member/$memberId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/org/$orgSlug/officer/finances/members/$memberId', params })
  },
  component: () => null,
})
