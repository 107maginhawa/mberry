import { useState, useEffect } from 'react'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { MemberTable } from '@/features/membership/components/member-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { api } from '@/lib/api'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  grace: 'gracePeriod',
  gracePeriod: 'gracePeriod',
  lapsed: 'lapsed',
  suspended: 'suspended',
  pending: 'pendingPayment',
  pendingPayment: 'pendingPayment',
}

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/roster/')({
  component: RosterPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string | undefined),
    expiring: search.expiring ? Number(search.expiring) : undefined,
  }),
})

function RosterPage() {
  const { orgId } = Route.useParams()
  const { status, expiring } = Route.useSearch()
  const [showAdd, setShowAdd] = useState(false)

  const initialStatus = status ? (STATUS_MAP[status] ?? status) : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-display font-bold">Member Roster</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} className="mr-1.5" />
          Add Member
        </Button>
      </div>
      <MemberTable orgId={orgId} initialStatus={initialStatus} expiringDays={expiring} />
      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} orgId={orgId} />
    </div>
  )
}

function AddMemberDialog({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!firstName.trim() || !email.trim()) {
      toast.error('First name and email are required')
      return
    }
    setSaving(true)
    try {
      // First create person record
      const personData: any = await api.post('/api/persons', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactInfo: { email: email.trim() },
      })
      const personId: string = personData.id || personData.data?.id

      // Then add membership
      await api.post(`/api/membership/members/${orgId}`, {
        personId,
        tierId: 'default',
        memberNumber: licenseNumber.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
      })

      toast.success(`${firstName} ${lastName} added as member`)
      setFirstName('')
      setLastName('')
      setEmail('')
      setLicenseNumber('')
      onClose()
      // Reload page to show new member
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cruz" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>License/Member Number</Label>
            <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="PRC-12345" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!firstName.trim() || !email.trim() || saving}>
            {saving ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
