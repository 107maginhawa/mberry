import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-title font-semibold text-foreground">Memberry</h1>
    </div>
  ),
})
