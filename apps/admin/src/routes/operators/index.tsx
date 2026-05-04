import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/operators/')({
  component: OperatorsPage,
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

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || 'Failed to invite admin')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Admin invited successfully')
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
      setEmail('')
      setName('')
      setRole('support')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invite Operator</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="super">Super Admin</option>
              <option value="support">Support</option>
              <option value="analyst">Analyst</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => invite.mutate()}
              disabled={!email || !name || invite.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {invite.isPending ? 'Inviting...' : 'Invite'}
            </button>
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

  const { data: admins, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: async () => {
      const res = await fetch('/api/admin/admins', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch admins')
      return res.json() as Promise<Admin[]>
    },
  })

  const revoke = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to revoke admin')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Admin access revoked')
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] })
      setRevokeTarget(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
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
        <p className="text-sm text-red-500 mb-4">Error: {(error as Error).message}</p>
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
                          onClick={() => revoke.mutate(admin.id)}
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
