import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCents } from '../lib/money'

interface UnpaidMember {
  personId: string
  name: string
  outstanding: number
  invoiceCount: number
}

interface TopUnpaidListProps {
  members: UnpaidMember[]
  currency?: string
  onSendReminder?: (personId: string) => void
}

export function TopUnpaidList({ members, currency = 'PHP', onSendReminder }: TopUnpaidListProps) {
  if (members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Unpaid Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8" role="status">
            All members are current
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Unpaid Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label="Top unpaid members">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.personId}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell className="text-right">
                  {formatCents(member.outstanding, currency)}
                </TableCell>
                <TableCell className="text-right">{member.invoiceCount}</TableCell>
                <TableCell className="text-right">
                  {onSendReminder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSendReminder(member.personId)}
                      aria-label={`Send reminder to ${member.name}`}
                    >
                      Send Reminder
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
