import { createFileRoute } from '@tanstack/react-router'
import Orgs from '../features/orgs/Orgs'

export const Route = createFileRoute('/')({ component: Orgs })
