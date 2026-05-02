import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { UserPlus, Trash2, Shield } from 'lucide-react'

interface OfficerManagementProps {
  orgId: string
}

type OfficerRole = 'President' | 'Vice President' | 'Secretary' | 'Treasurer' | 'Auditor' | 'Board Member'

const OFFICER_ROLES: OfficerRole[] = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Auditor',
  'Board Member',
]

interface Officer {
  id: string
  role: OfficerRole
  name: string
  email: string
  assignedDate: string
}

const MOCK_OFFICERS: Officer[] = [
  {
    id: '1',
    role: 'President',
    name: 'Dr. Maria Santos',
    email: 'msantos@org.example.com',
    assignedDate: '2024-01-15',
  },
  {
    id: '2',
    role: 'Vice President',
    name: 'Dr. Jose Reyes',
    email: 'jreyes@org.example.com',
    assignedDate: '2024-01-15',
  },
  {
    id: '3',
    role: 'Secretary',
    name: 'Dr. Ana Cruz',
    email: 'acruz@org.example.com',
    assignedDate: '2024-01-15',
  },
  {
    id: '4',
    role: 'Treasurer',
    name: 'Dr. Ricardo Lim',
    email: 'rlim@org.example.com',
    assignedDate: '2024-03-01',
  },
]

export function OfficerManagement({ orgId: _orgId }: OfficerManagementProps) {
  const [officers, setOfficers] = useState<Officer[]>(MOCK_OFFICERS)
  const [showModal, setShowModal] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<Officer | null>(null)

  function handleRemove(officer: Officer) {
    setOfficers((prev) => prev.filter((o) => o.id !== officer.id))
    setConfirmRemove(null)
    toast.success(`${officer.name} removed as ${officer.role}`)
  }

  function handleAssigned(officer: Officer) {
    setOfficers((prev) => [...prev, officer])
    setShowModal(false)
    toast.success(`${officer.name} assigned as ${officer.role}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[14px] text-[var(--color-muted)]">
          {officers.length} officer{officers.length !== 1 ? 's' : ''} assigned
        </p>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <UserPlus size={14} className="mr-1.5" />
          Assign Role
        </Button>
      </div>

      {/* Officer table */}
      <div className="rounded-[12px] border border-[var(--color-border-light)] overflow-hidden">
        <table className="w-full text-[14px]">
          <thead className="bg-[var(--color-surface-warm)]">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">
                Role
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">
                Name
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide hidden md:table-cell">
                Assigned Date
              </th>
              <th className="px-5 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {officers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  No officers assigned yet
                </td>
              </tr>
            ) : (
              officers.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-warm)] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Shield size={13} className="text-[var(--color-primary)] shrink-0" />
                      <span className="font-semibold">{o.role}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-[12px] text-[var(--color-muted)]">{o.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-muted)] hidden md:table-cell">
                    {new Date(o.assignedDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                      onClick={() => setConfirmRemove(o)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Role modal */}
      <AssignRoleModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAssign={handleAssigned}
      />

      {/* Confirm remove */}
      {confirmRemove && (
        <Dialog open onOpenChange={() => setConfirmRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Officer</DialogTitle>
            </DialogHeader>
            <p className="text-[14px]">
              Remove <strong>{confirmRemove.name}</strong> from the role of{' '}
              <strong>{confirmRemove.role}</strong>? This action cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmRemove(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRemove(confirmRemove)}
              >
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AssignRoleModal({
  open,
  onClose,
  onAssign,
}: {
  open: boolean
  onClose: () => void
  onAssign: (officer: Officer) => void
}) {
  const [role, setRole] = useState<string>('')
  const [memberSearch, setMemberSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit() {
    if (!role || !memberSearch.trim()) return
    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 400))
    onAssign({
      id: crypto.randomUUID(),
      role: role as OfficerRole,
      name: memberSearch.trim(),
      email: `${memberSearch.toLowerCase().replace(/\s+/g, '.')}@org.example.com`,
      assignedDate: new Date().toISOString().slice(0, 10),
    })
    setRole('')
    setMemberSearch('')
    setIsSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Officer Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {OFFICER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Member Name</Label>
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search member by name…"
            />
            <p className="text-[12px] text-[var(--color-muted)]">
              Member search will connect to the roster when the API is available.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!role || !memberSearch.trim() || isSaving}>
            {isSaving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
