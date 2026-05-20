import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Checkbox, Input } from '@monobase/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  updatePersonMutation,
  createPersonMutation,
  getPersonQueryKey,
} from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/onboarding')({
  component: MemberOnboarding,
})

/**
 * Member onboarding — optional profile completion after first login.
 * Not a gate: members can dismiss and return later from /my/settings.
 * PRD M-7: prompted on dashboard, dismissible after 3 times.
 */
function MemberOnboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [specialization, setSpecialization] = useState('')
  const [privacyDirectoryVisible, setPrivacyDirectoryVisible] = useState(true)

  const updatePerson = useMutation({
    ...updatePersonMutation(),
  })
  const createPerson = useMutation({
    ...createPersonMutation(),
  })

  const handleComplete = async () => {
    try {
      // Try update first; if person doesn't exist, create it
      try {
        await updatePerson.mutateAsync({
          path: { person: 'me' },
          body: {
            specialization: specialization || undefined,
          },
        })
      } catch {
        // Person doesn't exist yet — create it
        await createPerson.mutateAsync({
          body: {
            firstName: 'Member',
            specialization: specialization || undefined,
          },
        })
      }
      await queryClient.invalidateQueries({
        queryKey: getPersonQueryKey({ path: { person: 'me' } }),
      })
      navigate({ to: '/' })
    } catch {
      // Non-blocking — navigate anyway
      navigate({ to: '/' })
    }
  }

  const handleSkip = () => {
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full border rounded-lg p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-h2">Complete Your Profile</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Step {step} of 2 — you can skip and come back later
          </p>
          <div className="w-full bg-[var(--color-surface-warm)] rounded-full h-2">
            <div
              className="bg-[var(--color-primary)] h-2 rounded-full transition-all"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-h3">Specialization</h2>
            <p className="text-sm text-[var(--color-muted)]">
              What is your area of professional practice?
            </p>
            <Input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. General Dentistry, Orthodontics"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={handleSkip}
              >
                Skip for now
              </Button>
              <Button
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-h3">Privacy Preferences</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Control how your information appears in the member directory.
            </p>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer">
              <Checkbox
                checked={privacyDirectoryVisible}
                onCheckedChange={(val) => setPrivacyDirectoryVisible(val === true)}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Show in member directory</p>
                <p className="text-xs text-[var(--color-muted)]">
                  Other members can find your name and specialization
                </p>
              </div>
            </label>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={updatePerson.isPending}
                >
                  {updatePerson.isPending ? 'Saving...' : 'Complete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
