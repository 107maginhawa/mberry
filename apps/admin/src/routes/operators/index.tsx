import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { RequireRole } from '@/lib/role-gate'
import {
  listAdminsOptions,
  listAdminsQueryKey,
  inviteAdminMutation,
  revokeAdminMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/operators/')({
  component: () => (
    <RequireRole allowed={['super']}>
      <OperatorsPage />
    </RequireRole>
  ),
})

interface Admin {
  id: string
  name: string
  email: string
  role: string
  lastActiveAt?: string
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('support')

  const sdkInvite = inviteAdminMutation()
  const invite = useMutation({
    mutationFn: sdkInvite.mutationFn,
    onSuccess: () => {
      toast.success('Admin invited successfully')
      queryClient.invalidateQueries({ queryKey: listAdminsQueryKey() })
      setEmail('')
      setName('')
      setRole('support')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to invite admin'
      toast.error(msg)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invite Operator</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super">Super Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => invite.mutate({ body: { email, name, role: role as 'super' | 'support' | 'analyst' } })}
              disabled={!email || !name || invite.isPending}
            >
              {invite.isPending ? 'Inviting...' : 'Invite'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OperatorsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: sdkAdmins, isLoading, isError, error } = useQuery(listAdminsOptions())
  // Cast to local Admin interface which includes lastActiveAt (not in SDK type but returned by API)
  const admins = sdkAdmins as Admin[] | undefined

  const sdkRevoke = revokeAdminMutation()
  const revoke = useMutation({
    mutationFn: sdkRevoke.mutationFn,
    onSuccess: () => {
      toast.success('Admin access revoked')
      queryClient.invalidateQueries({ queryKey: listAdminsQueryKey() })
      setRevokeTarget(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to revoke admin'
      toast.error(msg)
      setRevokeTarget(null)
    },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Operators
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage platform administrators and their roles
            </p>
          </div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Operator
        </button>
      </div>

      {isError && (
        <p className="text-sm text-red-500 mb-4">Error: {error instanceof Error ? error.message : 'Failed to load operators'}</p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Active</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : !admins || admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No operators found.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-b last:border-b-0">
                  <td className="p-4 text-sm">{admin.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{admin.email}</td>
                  <td className="p-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted">
                      {admin.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {admin.lastActiveAt ? new Date(admin.lastActiveAt).toLocaleDateString() : '--'}
                  </td>
                  <td className="p-4 text-right">
                    {revokeTarget === admin.id ? (
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Revoke?</span>
                        <button
                          onClick={() => revoke.mutate({ path: { adminId: admin.id } })}
                          disabled={revoke.isPending}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                        >
                          {revoke.isPending ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setRevokeTarget(null)}
                          className="px-2 py-1 rounded text-xs font-medium border hover:bg-muted"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setRevokeTarget(admin.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Revoke access"
                        aria-label="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <InviteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
