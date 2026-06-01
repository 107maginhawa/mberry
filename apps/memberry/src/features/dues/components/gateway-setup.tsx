import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDuesGatewayConfigOptions,
  getDuesGatewayConfigQueryKey,
  upsertDuesGatewayConfigMutation,
  testDuesGatewayConnectionMutation,
  disconnectDuesGatewayMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { GatewayConfig } from '@monobase/sdk-ts/generated/types.gen'

/** Hand-wired endpoint extends GatewayConfig with masked key display field */
type GatewayConfigDetail = GatewayConfig & {
  publicKeyLast4?: string
}
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@monobase/ui'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react'

interface GatewaySetupProps {
  orgId: string
}

export function GatewaySetup({ orgId }: GatewaySetupProps) {
  const queryClient = useQueryClient()

  const [provider, setProvider] = useState<string>('paymongo')
  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [showDisconnect, setShowDisconnect] = useState(false)

  const { data: rawConfig, isLoading } = useQuery(getDuesGatewayConfigOptions({ path: { organizationId: orgId } }))
  const config = rawConfig as GatewayConfigDetail | undefined

  const testMutation = useMutation({
    ...testDuesGatewayConnectionMutation(),
    onSuccess: (data) => {
      setTestResult({ success: data.success, message: data.message })
    },
    onError: (err) => {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Connection test failed' })
      toast.error('Connection test failed', { description: err instanceof Error ? err.message : 'Please check your keys and try again.' })
    },
  })

  const saveMutation = useMutation({
    ...upsertDuesGatewayConfigMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getDuesGatewayConfigQueryKey({ path: { organizationId: orgId } }) })
      toast.success('Gateway connected', { description: 'Online payments are now enabled.' })
      setPublicKey('')
      setSecretKey('')
      setTestResult(null)
    },
    onError: () => {
      toast.error('Failed to save', { description: 'Please try again.' })
    },
  })

  const disconnectMutation = useMutation({
    ...disconnectDuesGatewayMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getDuesGatewayConfigQueryKey({ path: { organizationId: orgId } }) })
      setShowDisconnect(false)
      toast.success('Gateway disconnected')
    },
    onError: (err) => {
      toast.error('Failed to disconnect', { description: err instanceof Error ? err.message : 'Please try again.' })
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  // Connected state
  if (config?.connected) {
    return (
      <div className="space-y-4">
        <div className="p-4 border rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wifi className="h-5 w-5 text-green-600" />
            <div>
              <Badge variant="secondary" className="bg-[var(--color-success-bg)] text-[var(--color-success)]">Connected</Badge>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                {config.provider === 'paymongo' ? 'PayMongo' : 'Stripe'} ····{config.publicKeyLast4}
              </p>
              {config.lastTestAt && (
                <p className="text-xs text-[var(--color-muted)]">
                  Last tested: {new Date(config.lastTestAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowDisconnect(true)}>
            Disconnect
          </Button>
        </div>

        <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
          <DialogContent>
            <DialogHeader><DialogTitle>Disconnect Gateway?</DialogTitle></DialogHeader>
            <p className="text-sm">
              Members will not be able to pay online until a new gateway is configured.
              Pending payments are unaffected.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDisconnect(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate({ path: { organizationId: orgId } })}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Not connected state
  const canSave = testResult?.success && publicKey && secretKey

  return (
    <div className="space-y-6 max-w-lg">
      <div className="p-4 border rounded-lg flex items-center gap-3">
        <WifiOff className="h-5 w-5 text-red-500" />
        <div>
          <Badge variant="secondary" className="bg-[var(--color-error-bg)] text-[var(--color-error)]">Not Connected</Badge>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Connect a payment gateway to accept online payments.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Gateway Provider</Label>
          <Select value={provider} onValueChange={(v) => { setProvider(v); setTestResult(null) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paymongo">PayMongo</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Public Key</Label>
          <Input
            value={publicKey}
            onChange={(e) => { setPublicKey(e.target.value); setTestResult(null) }}
            placeholder={provider === 'paymongo' ? 'pk_live_...' : 'pk_live_...'}
          />
        </div>

        <div>
          <Label>Secret Key</Label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => { setSecretKey(e.target.value); setTestResult(null) }}
              placeholder={provider === 'paymongo' ? 'sk_live_...' : 'sk_live_...'}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
              {showSecret ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.success
              ? <CheckCircle className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />}
            {testResult.success ? 'Connection verified.' : `Connection failed: ${testResult.error}`}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate({ path: { organizationId: orgId } })}
            disabled={!publicKey || !secretKey || testMutation.isPending}
          >
            {testMutation.isPending ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={() => saveMutation.mutate({ path: { organizationId: orgId }, body: { provider: provider as 'paymongo' | 'stripe', publicKey, secretKey } })}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save & Activate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
