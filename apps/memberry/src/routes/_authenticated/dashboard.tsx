import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Memberry Dashboard</h1>
      <p className="text-muted-foreground">
        Healthcare Association Management System
      </p>
    </div>
  )
}
