import { createFileRoute } from '@tanstack/react-router'
import { RequireRole } from '@/lib/role-gate'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { FileText, Plus } from 'lucide-react'

export const Route = createFileRoute('/communications/templates')({
  component: PlatformTemplates,
})

function PlatformTemplates() {
  return (
    <RequireRole allowed={['super']}>
      <PageShell
        title="Platform Templates"
        subtitle="Manage templates available to all organizations"
        maxWidth="full"
        actions={
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        }
      >
        <div className="space-y-6">
        {/* Template categories */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">All</Button>
          <Button variant="ghost" size="sm">Email</Button>
          <Button variant="ghost" size="sm">Push</Button>
          <Button variant="ghost" size="sm">In-App</Button>
        </div>

        {/* Template list */}
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No platform templates yet. Create templates that organizations can adopt.
            </p>
          </CardContent>
        </Card>
        </div>
      </PageShell>
    </RequireRole>
  )
}
