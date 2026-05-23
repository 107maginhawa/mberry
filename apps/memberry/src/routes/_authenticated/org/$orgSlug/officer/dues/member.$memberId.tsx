import { createFileRoute, Link } from '@tanstack/react-router'
import { useOrg } from '@/hooks/useOrg'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Badge } from '@monobase/ui'
import { ArrowLeft } from 'lucide-react'
import { formatCents } from '@/features/dues/lib/money'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/dues/member/$memberId')({
  component: MemberFinancialDetailPage,
})

function MemberFinancialDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { memberId } = Route.useParams()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dues-member-summary', orgId, memberId],
    queryFn: () =>
      api.get(`/association/member/dues-member-summary/${orgId}/${memberId}`).then(r => r.data),
    enabled: !!orgId && !!memberId,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          to="/org/$orgSlug/officer/dues/treasurer"
          params={{ orgSlug }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Member Financial Detail</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {formatCents(summary?.balance ?? 0, 'PHP')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{summary?.invoices?.length ?? 0}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{summary?.payments?.length ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {(summary?.invoices?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-center py-4">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {summary.invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {inv.periodStart} — {inv.periodEnd}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatCents(inv.totalAmount, 'PHP')}</span>
                    <Badge variant={inv.status === 'paid' ? 'default' : 'destructive'}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {(summary?.payments?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payments yet</p>
          ) : (
            <div className="space-y-2">
              {summary.payments.map((pay: any) => (
                <div key={pay.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="font-medium">{formatCents(pay.amount, 'PHP')}</span>
                    <span className="text-sm text-muted-foreground ml-2">{pay.paymentMethod}</span>
                  </div>
                  <Badge variant={pay.status === 'completed' ? 'default' : 'secondary'}>
                    {pay.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {summary?.statusTimeline?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.statusTimeline.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{entry.changedAt}</span>
                  {entry.fromStatus && (
                    <>
                      <Badge variant="outline">{entry.fromStatus}</Badge>
                      <span>→</span>
                    </>
                  )}
                  <Badge>{entry.toStatus}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
