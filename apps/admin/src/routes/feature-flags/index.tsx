import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ToggleLeft, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RequireRole } from '@/lib/role-gate'
import {
  listFeatureFlagsOptions,
  listFeatureFlagsQueryKey,
  setFeatureFlagMutation,
  deleteFeatureFlagMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/feature-flags/')({
  component: () => (
    <RequireRole allowed={['super']}>
      <FeatureFlagsPage />
    </RequireRole>
  ),
})

interface FeatureFlag {
  id: string
  targetType: string
  targetId: string
  moduleName: string
  enabled: boolean
  createdAt?: string
}

const moduleOptions = [
  'person',
  'booking',
  'billing',
  'audit',
  'notifs',
  'comms',
  'storage',
  'email',
  'reviews',
]

function CreateFlagDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [targetType, setTargetType] = useState('global')
  const [targetId, setTargetId] = useState('')
  const [moduleName, setModuleName] = useState<string>(moduleOptions[0] ?? 'person')
  const [enabled, setEnabled] = useState(true)

  const sdkSetFlag = setFeatureFlagMutation()
  const create = useMutation({
    mutationFn: sdkSetFlag.mutationFn,
    onSuccess: () => {
      toast.success('Feature flag created')
      queryClient.invalidateQueries({ queryKey: listFeatureFlagsQueryKey() })
      setTargetType('global')
      setTargetId('')
      setModuleName(moduleOptions[0] ?? 'person')
      setEnabled(true)
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create flag'
      toast.error(msg)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Feature Flag</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Module</label>
            <select
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {moduleOptions.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Type</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="global">Global</option>
              <option value="association">Association</option>
              <option value="organization">Organization</option>
            </select>
          </div>
          {targetType !== 'global' && (
            <div>
              <label className="block text-sm font-medium mb-1">Target ID</label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={`${targetType} ID`}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Enabled</label>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                enabled ? 'bg-green-500 justify-end' : 'bg-muted justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => create.mutate({ body: { targetType, targetId: (targetId || targetType) as string, moduleName, enabled } })}
              disabled={create.isPending || (targetType !== 'global' && !targetId)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {create.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureFlagsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: flags, isLoading, isError, error } = useQuery(listFeatureFlagsOptions())

  const sdkDeleteFlag = deleteFeatureFlagMutation()
  const deleteFlag = useMutation({
    mutationFn: sdkDeleteFlag.mutationFn,
    onSuccess: () => {
      toast.success('Feature flag deleted')
      queryClient.invalidateQueries({ queryKey: listFeatureFlagsQueryKey() })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete flag'
      toast.error(msg)
    },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ToggleLeft className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Feature Flags
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Module x target matrix &mdash; control which modules are enabled per
              scope
            </p>
          </div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Flag
        </button>
      </div>

      {isError && (
        <p className="text-sm text-red-500 mb-4">Error: {error instanceof Error ? error.message : 'Failed to load feature flags'}</p>
      )}

      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Module</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Target Type</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Target ID</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Enabled</th>
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
            ) : !flags || flags.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No feature flags configured.
                </td>
              </tr>
            ) : (
              flags.map((flag) => (
                <tr key={flag.id} className="border-b last:border-b-0">
                  <td className="p-4 text-sm font-medium">{flag.moduleName}</td>
                  <td className="p-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted">
                      {flag.targetType}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {flag.targetId || '--'}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <div
                        className={`w-10 h-6 rounded-full flex items-center px-1 ${
                          flag.enabled ? 'bg-green-500 justify-end' : 'bg-muted justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow" />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteFlag.mutate({ path: { flagId: flag.id } })}
                      disabled={deleteFlag.isPending}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete flag"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateFlagDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
