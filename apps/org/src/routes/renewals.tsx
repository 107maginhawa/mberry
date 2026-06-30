import { createFileRoute } from '@tanstack/react-router'
import { Renewals } from '@/features/renewals/Renewals'

export const Route = createFileRoute('/renewals')({ component: Renewals })
