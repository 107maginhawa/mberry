import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { UserPlus, Trash2, Shield } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { Combobox } from '@/components/patterns/combobox'

interface OfficerManagementProps {
  orgId: string
}

interface Position {
  id: string
  title: string
}

interface MemberResult {
  id: string
  personId: string
  name: string
  email: string
}

interface Officer {
  id: string
  role: string
  name: string
  email: string
  assignedDate: string
  termId?: string
}

export function OfficerManagement({ orgId }: OfficerManagementProps) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<Officer | null>(null)

  const { data: officers = [], isLoading: loading } = useQuery({
    queryKey: ['officer-terms', orgId],
    queryFn: async () => {
      const json = await api.get<any>(`/api/association/member/officer-terms`, { 'x-org-id': orgId })
      const terms = json.data || json.items || []
      return terms
        .filter((t: any) => t.status === 'active')
        .map((t: any) => ({
          id: t.id,
          role: t.position?.title || t.positionTitle || 'Officer',
          name: t.person?.name || t.personName || 'Unknown',
          email: t.person?.email || t.personEmail || '',
          assignedDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
          termId: t.id,
        })) as Officer[]
    },
  })

  async function handleRemove(officer: Officer) {
    const queryKey = ['officer-terms', orgId]
    // Optimistic: remove row immediately
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old: Officer[] | undefined) =>
      old ? old.filter((o) => o.id !== officer.id) : old
    )
    setConfirmRemove(null)

    try {
      const termId = officer.termId || officer.id
      await api.delete(`/api/association/member/officer-terms/${termId}`, { 'x-org-id': orgId })
      toast.success(`${officer.name} removed as ${officer.role}`)
    } catch {
      // Rollback on error
      queryClient.setQueryData(queryKey, previous)
      toast.error('Failed to remove officer')
    }
    queryClient.invalidateQueries({ queryKey })
  }

  function handleAssigned(officer: Officer) {
    setShowModal(false)
    toast.success(`${officer.name} assigned as ${officer.role}`)
    queryClient.invalidateQueries({ queryKey: ['officer-terms', orgId] })
  }

  if (loading) {
    return <TableSkeleton rows={4} />
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
      <GlassCard className="overflow-hidden">
        <Table className="text-[14px]">
          <TableHeader className="bg-[var(--color-surface-warm)]">
            <TableRow>
              <TableHead className="px-5 py-3 font-semibold text-[12px] uppercase tracking-wide">
                Role
              </TableHead>
              <TableHead className="px-5 py-3 font-semibold text-[12px] uppercase tracking-wide">
                Name
              </TableHead>
              <TableHead className="px-5 py-3 font-semibold text-[12px] uppercase tracking-wide hidden md:table-cell">
                Assigned Date
              </TableHead>
              <TableHead className="px-5 py-3 w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {officers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState
                    icon={<Shield className="w-8 h-8" />}
                    headline="No officers assigned"
                    description="Assign organization roles to get started."
                  />
                </TableCell>
              </TableRow>
            ) : (
              officers.map((o) => (
                <TableRow
                  key={o.id}
                  className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-warm)] transition-colors"
                >
                  <TableCell className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Shield size={13} className="text-[var(--color-primary)] shrink-0" />
                      <span className="font-semibold">{o.role}</span>
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-3.5">
                    <div>
                      <p className="font-medium">{o.name}</p>
                      {o.email && <p className="text-[12px] text-[var(--color-muted)]">{o.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-[var(--color-muted)] hidden md:table-cell">
                    {o.assignedDate ? new Date(o.assignedDate).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                      onClick={() => setConfirmRemove(o)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Assign Role modal */}
      <AssignRoleModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAssign={handleAssigned}
        orgId={orgId}
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
  orgId,
}: {
  open: boolean
  onClose: () => void
  onAssign: (officer: Officer) => void
  orgId: string
}) {
  const [positionId, setPositionId] = useState<string>('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState<MemberResult[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null)
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { data: positions = [], isLoading: loadingPositions } = useQuery({
    queryKey: ['officer-positions', orgId],
    queryFn: async () => {
      const json = await api.get<any>('/api/association/member/positions', { 'x-org-id': orgId })
      return (json.items || json.data || []) as Position[]
    },
    enabled: open,
  })

  // Debounced member search
  useEffect(() => {
    if (!memberSearch.trim() || memberSearch.trim().length < 2) {
      setMemberResults([])
      return
    }
    const timer = setTimeout(() => {
      setSearchingMembers(true)
      api.get<any>(`/api/membership/members/${orgId}?search=${encodeURIComponent(memberSearch.trim())}&limit=10`)
        .then((json) => {
          const members = json.data || json.items || []
          setMemberResults(
            members.map((m: any) => ({
              id: m.id,
              personId: m.personId || m.id,
              name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Unknown',
              email: m.email || '',
            }))
          )
        })
        .catch(() => setMemberResults([]))
        .finally(() => setSearchingMembers(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [memberSearch, orgId])

  function handleSelectMember(member: MemberResult) {
    setSelectedMember(member)
    setMemberSearch(member.name)
    setMemberResults([])
  }

  async function handleSubmit() {
    if (!positionId || !selectedMember) return
    setIsSaving(true)
    try {
      const json = await api.post<any>('/api/association/member/officer-terms', {
        positionId,
        personId: selectedMember.personId,
        organizationId: orgId,
        startDate: new Date().toISOString().slice(0, 10),
        status: 'active',
      }, { 'x-org-id': orgId })
      const position = positions.find((p) => p.id === positionId)
      onAssign({
        id: json.id || crypto.randomUUID(),
        role: position?.title || 'Officer',
        name: selectedMember.name,
        email: selectedMember.email,
        assignedDate: new Date().toISOString().slice(0, 10),
        termId: json.id,
      })
    } catch {
      toast.error('Failed to assign officer role')
    } finally {
      setPositionId('')
      setMemberSearch('')
      setSelectedMember(null)
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Officer Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Combobox
              options={positions.map((p) => ({ value: p.id, label: p.title }))}
              value={positionId || undefined}
              onValueChange={setPositionId}
              placeholder={loadingPositions ? 'Loading positions...' : 'Select a position'}
              searchPlaceholder="Search positions..."
              emptyMessage="No positions found."
              disabled={loadingPositions}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Member</Label>
            <Combobox
              options={memberResults.map((m) => ({
                value: m.id,
                label: m.name,
                description: m.email || undefined,
              }))}
              value={selectedMember?.id}
              onValueChange={(val) => {
                const member = memberResults.find((m) => m.id === val)
                if (member) handleSelectMember(member)
              }}
              onSearchChange={(search) => {
                setMemberSearch(search)
                setSelectedMember(null)
              }}
              placeholder="Search member by name..."
              searchPlaceholder="Type to search members..."
              emptyMessage="No members found."
              loading={searchingMembers}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!positionId || !selectedMember || isSaving}>
            {isSaving ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
