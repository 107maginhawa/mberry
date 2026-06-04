import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getMerchantAccountOptions } from '@monobase/sdk-ts/generated/react-query'
import {
  startBillingOnboarding,
  getAccountSetupStatus,
} from '@monobase/sdk-ts/flows'
import { SdkError } from '@monobase/sdk-ts/client'
import { MerchantAccountSetup } from '@/features/billing/components/merchant-account-setup'
import { Button } from '@monobase/ui'
import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/patterns/page-shell'

export const Route = createFileRoute('/_authenticated/my/billing')({
  component: BillingPage,
})

const STALL_TIMEOUT_MS = 12_000

// oli-execute: error-handled-inline
function BillingPage() {
  const navigate = useNavigate()
  const [isStarting, setIsStarting] = useState(false)
  const [stalled, setStalled] = useState(false)

  const accountQuery = useQuery({
    ...getMerchantAccountOptions({ path: { merchantAccount: 'me' } }),
    retry: (failureCount, err) => {
      if (err instanceof SdkError && err.status === 404) return false
      return failureCount < 3
    },
  })

  const isNotFound = accountQuery.error instanceof SdkError && accountQuery.error.status === 404
  const account = isNotFound ? null : accountQuery.data ?? null
  const status = getAccountSetupStatus(account)

  const onboard = useMutation({
    mutationFn: () =>
      startBillingOnboarding({
        refreshUrl: window.location.href,
        returnUrl: window.location.origin + '/my/billing',
      }),
    meta: { toast: { error: 'Could not start payment setup' } },
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  useEffect(() => {
    if (onboard.isError) setIsStarting(false)
  }, [onboard.isError])

  useEffect(() => {
    if (!(accountQuery.isPending || isStarting)) {
      setStalled(false)
      return
    }
    const handle = window.setTimeout(() => setStalled(true), STALL_TIMEOUT_MS)
    return () => window.clearTimeout(handle)
  }, [accountQuery.isPending, isStarting])

  const transportFailed = accountQuery.isError && !isNotFound

  const subtitle = "Connect a Stripe account if you want to charge for your sessions."

  if (transportFailed || stalled) {
    return (
      <PageShell title="Billing" subtitle={subtitle}>
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">
              {transportFailed ? 'Could not load billing status' : 'Billing is taking longer than expected'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {transportFailed
              ? 'The server returned an error. Retry, or skip for now.'
              : 'The request has not resolved. Retry, or skip for now.'}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setStalled(false)
                setIsStarting(false)
                accountQuery.refetch()
              }}
            >
              Retry
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
              Skip for now
            </Button>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Billing" subtitle={subtitle}>
      <MerchantAccountSetup
        account={account ? { id: account.id, metadata: account.metadata as { onboardingStartedAt?: string } | undefined } : null}
        status={status}
        isLoading={accountQuery.isPending || isStarting}
        onSetupAccount={() => {
          setIsStarting(true)
          onboard.mutate()
        }}
        onSubmit={() => navigate({ to: '/dashboard' })}
        onSkip={() => navigate({ to: '/dashboard' })}
      />
    </PageShell>
  )
}
