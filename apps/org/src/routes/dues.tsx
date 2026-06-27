import { createFileRoute } from '@tanstack/react-router'
import { Dues } from '../features/dues/DuesView'

export const Route = createFileRoute('/dues')({
  component: Dues,
})
