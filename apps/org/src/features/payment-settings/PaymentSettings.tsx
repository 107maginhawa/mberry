import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, Button, Input, Label, StatusBadge, ConfirmDialog, ErrorState, Skeleton } from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useGatewayConfig } from './use-gateway-config'

export function PaymentSettings() {
  const { orgId } = useSelectedOrg()
  const { statusQuery, connect, test, disconnect } = useGatewayConfig(orgId)

  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [showDisconnect, setShowDisconnect] = useState(false)

  const config = statusQuery.data
  const connected = config?.connected ?? false
  const configPublicKey = config?.publicKey
  const isTest = configPublicKey?.startsWith('pk_test_') ?? false
  const lastTestAt = config?.lastTestAt

  // VITE_API_URL = absolute public API origin (hit by PayMongo directly; do NOT derive from window.location)
  const publicApiOrigin = import.meta.env.VITE_API_URL as string | undefined
  const webhookUrl = publicApiOrigin
    ? `${publicApiOrigin}/webhooks/paymongo/${orgId}`
    : `<your API domain>/webhooks/paymongo/${orgId}`

  function onConnectSubmit(e: React.FormEvent) {
    e.preventDefault()
    setConnectError(null)
    connect.mutate(
      {
        publicKey,
        secretKey,
        ...(webhookSecret ? { webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Credentials saved')
          setSecretKey('')
          setWebhookSecret('')
        },
        onError: (err) => {
          setConnectError((err as Error).message ?? 'Could not save credentials.')
        },
      },
    )
  }

  async function onTest() {
    try {
      const data = await test.mutateAsync()
      if (data?.success) {
        toast.success(data.message ?? 'Connection test passed.')
      } else {
        toast.error(data?.message ?? 'Connection test failed.')
      }
    } catch (err) {
      toast.error((err as Error).message ?? 'Connection test failed.')
    }
  }

  async function doDisconnect() {
    try {
      await disconnect.mutateAsync()
      toast.success('PayMongo disconnected.')
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not disconnect.')
    }
  }

  if (!orgId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-body text-muted-foreground">Select an organization first.</p>
        </CardContent>
      </Card>
    )
  }

  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div role="status" aria-label="Loading payment settings" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (statusQuery.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState
            message="We couldn't load payment settings."
            onRetry={() => void statusQuery.refetch()}
          />
          <p className="mt-2 text-caption text-muted-foreground">
            Requires a Treasurer or President with two-factor authentication enabled.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* 2FA / officer note — mirror B3 style */}
        <p className="mb-4 text-body text-muted-foreground">
          Requires a Treasurer or President with two-factor authentication enabled. If you see a
          403 error, ensure your officer role has 2FA active.
        </p>

        {/* Connection status */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {connected ? (
            <>
              <StatusBadge variant="success">Connected</StatusBadge>
              {isTest && <StatusBadge variant="warning">Test mode</StatusBadge>}
              {lastTestAt && (
                <span className="text-caption text-muted-foreground">
                  Last tested:{' '}
                  {lastTestAt instanceof Date
                    ? lastTestAt.toLocaleString()
                    : String(lastTestAt)}
                </span>
              )}
            </>
          ) : (
            <StatusBadge variant="muted">Not connected</StatusBadge>
          )}
        </div>

        {/* Public key — non-secret, shown plain */}
        {configPublicKey && (
          <p className="mb-4 text-caption text-muted-foreground">
            Public key: <span className="font-mono">{configPublicKey}</span>
          </p>
        )}

        {/* Connect / update form */}
        <form onSubmit={onConnectSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ps-pubkey">PayMongo public key (pk_…)</Label>
            <Input
              id="ps-pubkey"
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              required
              placeholder="pk_live_… or pk_test_…"
            />
          </div>
          <div>
            <Label htmlFor="ps-seckey">PayMongo secret key (sk_…)</Label>
            {/* type="password" — server never returns this; never pre-fill */}
            <Input
              id="ps-seckey"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              required
              placeholder="sk_live_… or sk_test_…"
            />
          </div>
          <div>
            <Label htmlFor="ps-webhook">Webhook signing secret (optional — can be added later)</Label>
            {/* type="password" — server never returns this; never pre-fill */}
            <Input
              id="ps-webhook"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_…"
            />
          </div>
          {connectError && (
            <p role="alert" className="text-body text-destructive">
              {connectError}
            </p>
          )}
          <Button type="submit" disabled={connect.isPending} className="min-h-tap">
            {connect.isPending
              ? 'Saving…'
              : connected
                ? 'Update credentials'
                : 'Connect PayMongo'}
          </Button>
        </form>

        {/* Webhook URL block */}
        <div className="mt-6 rounded-md bg-muted p-4 text-caption">
          <p className="mb-1 font-medium">Webhook URL</p>
          <p className="mb-2 break-all font-mono text-caption">{webhookUrl}</p>
          {publicApiOrigin && (
            <Button
              type="button"
              variant="outline"
              className="mb-2 min-h-tap"
              onClick={() => {
                void navigator.clipboard.writeText(webhookUrl)
                toast.success('Copied!')
              }}
            >
              Copy URL
            </Button>
          )}
          <p className="text-muted-foreground">
            Add in PayMongo → Developers → Webhooks, event{' '}
            <code className="font-mono">payment.paid</code>.
          </p>
          <p className="mt-1 text-muted-foreground">
            Test keys (<code className="font-mono">pk_test_</code>/
            <code className="font-mono">sk_test_</code>) work end-to-end without live activation.
          </p>
        </div>

        {/* Test + Disconnect — only when connected */}
        {connected && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-tap"
              disabled={test.isPending}
              onClick={() => void onTest()}
            >
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-tap"
              disabled={disconnect.isPending}
              onClick={() => setShowDisconnect(true)}
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={showDisconnect}
          onOpenChange={setShowDisconnect}
          title="Disconnect PayMongo?"
          description="Members will not be able to pay online until you reconnect."
          confirmLabel="Disconnect"
          variant="high-consequence"
          onConfirm={() => {
            setShowDisconnect(false)
            void doDisconnect()
          }}
        />
      </CardContent>
    </Card>
  )
}
