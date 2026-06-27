import { createFileRoute } from '@tanstack/react-router'

// Stub sign-in page — full auth form added in a later task.
export const Route = createFileRoute('/sign-in')({
  component: () => (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-title font-semibold text-foreground">Sign In</h1>
    </div>
  ),
})
