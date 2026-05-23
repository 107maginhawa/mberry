import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getMerchantAccountOptions } from '@monobase/sdk-ts/generated/react-query'
import {
  startBillingOnboarding,
  getAccountSetupStatus,
} from '@monobase/sdk-ts/flows'
import { SdkError } from '@monobase/sdk-ts/client'
import { MerchantAccountSetup } from '@/features/billing/components/merchant-account-setup'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/my/billing')({
  component: BillingPage,
})

function BillingPage() {
  const navigate = useNavigate()
  const [isStarting, setIsStarting] = useState(false)

  // Fetch the user's merchant account; 404 means "not yet created"
  // and getAccountSetupStatus(null) -> 'none'.
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

  const handleSetup = () => {
    setIsStarting(true)
    onboard.mutate()
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-h1">Billing</h1>
        <p className="text-muted-foreground">
          Connect a Stripe account if you want to charge for your sessions.
        </p>
      </div>
      <MerchantAccountSetup
        account={account ? { id: account.id, metadata: account.metadata as { onboardingStartedAt?: string } | undefined } : null}
        status={status}
        isLoading={accountQuery.isPending || isStarting}
        onSetupAccount={handleSetup}
        onSubmit={() => navigate({ to: '/dashboard' })}
        onSkip={() => navigate({ to: '/dashboard' })}
      />
    </div>
  )
}
