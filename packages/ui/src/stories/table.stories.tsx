import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../components/table"
import { Badge } from "../components/badge"

const members = [
  { id: "001", name: "Maria Santos", email: "maria@example.com", status: "Active", dues: "Paid" },
  { id: "002", name: "Juan dela Cruz", email: "juan@example.com", status: "Active", dues: "Overdue" },
  { id: "003", name: "Ana Reyes", email: "ana@example.com", status: "Inactive", dues: "Paid" },
  { id: "004", name: "Pedro Bautista", email: "pedro@example.com", status: "Active", dues: "Pending" },
]

export const Default = () => (
  <Table>
    <TableCaption>List of association members</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>ID</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Dues</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {members.map((member) => (
        <TableRow key={member.id}>
          <TableCell>{member.id}</TableCell>
          <TableCell className="font-medium">{member.name}</TableCell>
          <TableCell>{member.email}</TableCell>
          <TableCell>
            <Badge variant={member.status === "Active" ? "default" : "secondary"}>
              {member.status}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge
              variant={
                member.dues === "Paid"
                  ? "default"
                  : member.dues === "Overdue"
                  ? "destructive"
                  : "outline"
              }
            >
              {member.dues}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)

export const Simple = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Amount</TableHead>
        <TableHead>Date</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Annual Dues</TableCell>
        <TableCell>P2,500</TableCell>
        <TableCell>2025-01-15</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Conference Fee</TableCell>
        <TableCell>P1,000</TableCell>
        <TableCell>2025-03-20</TableCell>
      </TableRow>
    </TableBody>
  </Table>
)
