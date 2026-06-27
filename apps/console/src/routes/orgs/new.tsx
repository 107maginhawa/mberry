import { createFileRoute } from '@tanstack/react-router'
import CreateOrg from '../../features/orgs/CreateOrg'

export const Route = createFileRoute('/orgs/new')({
  component: CreateOrg,
})
