import { createFileRoute } from '@tanstack/react-router'
import ImportRoster from '../features/roster-import/ImportRoster'

export const Route = createFileRoute('/import')({
  component: ImportRoster,
})
