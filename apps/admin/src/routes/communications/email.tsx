import { createFileRoute } from '@tanstack/react-router'
import { RequireRole } from '@/lib/role-gate'
import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui'
import { Mail, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

export const Route = createFileRoute('/communications/email')({
  component: EmailHealth,
})

function StatusCard({ title, value, status, icon: Icon }: { title: string; value: string; status: 'healthy' | 'warning' | 'error'; icon: typeof Mail }) {
  const statusColors = {
    healthy: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  }
  const StatusIcon = status === 'healthy' ? CheckCircle : status === 'warning' ? AlertTriangle : XCircle

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Icon className="h-6 w-6 text-muted-foreground/50" />
            <StatusIcon className={`h-4 w-4 ${statusColors[status]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmailHealth() {
  return (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Email Health</h1>
          <p className="text-sm text-muted-foreground">
            Monitor email delivery, bounce rates, and suppressions
          </p>
        </div>

        {/* Health stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusCard title="Sent (24h)" value="1,847" status="healthy" icon={Mail} />
          <StatusCard title="Bounce Rate" value="2.1%" status="warning" icon={Mail} />
          <StatusCard title="Queue Pending" value="12" status="healthy" icon={Mail} />
          <StatusCard title="Suppressions" value="34" status="healthy" icon={Mail} />
        </div>

        {/* Queue status */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Sent</span>
                <span className="font-medium">1,834</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Processing</span>
                <span className="font-medium">1</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium text-red-600">2</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suppressions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Suppressions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Suppression list will be populated from email queue data.
            </p>
          </CardContent>
        </Card>
      </div>
    </RequireRole>
  )
}
