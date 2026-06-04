// ui-c-exempt: landing-page — public landing root
import { createFileRoute, redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/router'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }: { context: RouterContext }) => {
    if (context.auth.user) {
      throw redirect({ to: '/dashboard' })
    }
    // Guest → go to sign-in
    throw redirect({
      to: '/auth/$authView',
      params: { authView: 'sign-in' },
    })
  },
  component: () => null, // Never renders — always redirects
})
