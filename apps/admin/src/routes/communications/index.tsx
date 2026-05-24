import { createFileRoute } from '@tanstack/react-router'
import { RequireRole } from '@/lib/role-gate'
import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui'
import { Radio, Mail, ShieldAlert, Send } from 'lucide-react'

export const Route = createFileRoute('/communications/')({
  component: CommunicationsBroadcasts,
})

function StatCard({ title, value, trend, icon: Icon }: { title: string; value: string; trend?: string; icon: typeof Radio }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  )
}

function CommunicationsBroadcasts() {
  return (
    <RequireRole allowed={['super', 'support']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Broadcasts</h1>
          <p className="text-sm text-muted-foreground">Send communications to all organizations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Broadcasts Sent" value="34" trend="This month" icon={Send} />
          <StatCard title="Total Recipients" value="1,247" icon={Radio} />
          <StatCard title="Email Queue" value="12" trend="Pending" icon={Mail} />
          <StatCard title="Flagged Content" value="5" trend="Pending review" icon={ShieldAlert} />
        </div>

        {/* Broadcast form placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Send Platform Broadcast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Platform-wide broadcast form will be implemented here. Target specific associations,
              organizations, or all members. Supports email, push, and in-app channels.
            </p>
          </CardContent>
        </Card>

        {/* Recent broadcasts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Broadcasts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
          </CardContent>
        </Card>
      </div>
    </RequireRole>
  )
}
