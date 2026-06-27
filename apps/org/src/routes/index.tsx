import { createFileRoute } from '@tanstack/react-router'
import Roster from '../features/roster/Roster'

export const Route = createFileRoute('/')({
  component: Roster,
})
