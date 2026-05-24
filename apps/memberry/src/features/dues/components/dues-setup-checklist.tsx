import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle, Circle } from 'lucide-react'
import { getDuesConfigOptions } from '@monobase/sdk-ts/generated/react-query'
import { getDuesGatewayConfigOptions } from '@monobase/sdk-ts/generated/react-query'
import { listDuesFundsOptions } from '@monobase/sdk-ts/generated/react-query'
import { GlassCard } from '@/components/motion/glass-card'

interface DuesSetupChecklistProps {
  orgId: string
}

interface StepDef {
  key: string
  title: string
  description: string
  href: string
  isComplete: boolean
}

export function DuesSetupChecklist({ orgId }: DuesSetupChecklistProps) {
  const configQuery = useQuery(
    getDuesConfigOptions({
      path: { organizationId: orgId },
      headers: { 'x-org-id': orgId },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  )

  const gatewayQuery = useQuery(
    getDuesGatewayConfigOptions({
      path: { organizationId: orgId },
      headers: { 'x-org-id': orgId },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  )

  const fundsQuery = useQuery(
    listDuesFundsOptions({
      path: { organizationId: orgId },
      headers: { 'x-org-id': orgId },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  )

  const isLoading = configQuery.isLoading || gatewayQuery.isLoading || fundsQuery.isLoading

  if (isLoading) return null

  const config = configQuery.data as any
  const gateway = gatewayQuery.data as any
  const funds = fundsQuery.data as any

  const hasDuesAmount = !!(
    config &&
    ((config.annualAmount != null && Number(config.annualAmount) > 0) ||
      (config.defaultAmount != null && Number(config.defaultAmount) > 0))
  )

  const hasBillingSchedule = !!(config && config.billingFrequency)

  const hasGateway = !!(gateway && gateway.connected === true)

  const fundsArray = Array.isArray(funds) ? funds : funds?.data ?? funds?.items ?? []
  const hasFunds = fundsArray.length > 0

  const steps: StepDef[] = [
    {
      key: 'dues-amount',
      title: 'Set dues amount',
      description: 'Configure the annual or default membership dues amount.',
      href: `/org/${orgId}/officer/settings/dues`,
      isComplete: hasDuesAmount,
    },
    {
      key: 'billing-schedule',
      title: 'Configure billing schedule',
      description: 'Set how often members are billed for dues.',
      href: `/org/${orgId}/officer/settings/dues`,
      isComplete: hasBillingSchedule,
    },
    {
      key: 'payment-gateway',
      title: 'Connect payment gateway',
      description: 'Enable online payment collection for members.',
      href: `/org/${orgId}/officer/settings/gateway`,
      isComplete: hasGateway,
    },
    {
      key: 'fund-allocation',
      title: 'Set up fund allocation',
      description: 'Create at least one fund to track where dues go.',
      href: `/org/${orgId}/officer/settings/funds`,
      isComplete: hasFunds,
    },
  ]

  const allComplete = steps.every((s) => s.isComplete)
  const completedCount = steps.filter((s) => s.isComplete).length

  if (allComplete) return null

  return (
    <GlassCard className="p-5 mb-6" data-testid="dues-setup-checklist">
      <div className="mb-4">
        <h3 className="text-[16px] font-semibold">Dues Setup</h3>
        <p className="text-[13px] text-[var(--color-muted)] mt-0.5">
          {completedCount} of {steps.length} steps complete
        </p>
      </div>
      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              to={step.href as any /* eslint-disable-line @typescript-eslint/no-explicit-any */}
              className="flex items-start gap-3 group"
            >
              {step.isComplete ? (
                <CheckCircle className="h-5 w-5 text-[var(--color-success)] shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-[var(--color-muted)] shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-[14px] font-medium group-hover:text-[var(--color-primary)] transition-colors ${
                    step.isComplete ? 'line-through text-[var(--color-muted)]' : ''
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[12px] text-[var(--color-muted)]">{step.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
