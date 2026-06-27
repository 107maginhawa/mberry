import { createFileRoute } from '@tanstack/react-router'
import SendLink from '@/features/paylink/SendLink'

export const Route = createFileRoute('/members/$membershipId/send')({
  validateSearch: (search: Record<string, unknown>) => ({
    personId: typeof search.personId === 'string' ? search.personId : undefined,
    name: typeof search.name === 'string' ? search.name : undefined,
  }),
  component: SendLink,
})
