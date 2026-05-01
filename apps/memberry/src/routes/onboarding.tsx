import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  updatePersonMutation,
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

  const handleComplete = async () => {
    try {
      await updatePerson.mutateAsync({
        path: { person: 'me' },
        body: {
          specialization: specialization || undefined,
        },
      })
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
          <h1 className="text-2xl font-bold">Complete Your Profile</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 2 — you can skip and come back later
          </p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Specialization</h2>
            <p className="text-sm text-muted-foreground">
              What is your area of professional practice?
            </p>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. General Dentistry, Orthodontics"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <div className="flex justify-between">
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Privacy Preferences</h2>
            <p className="text-sm text-muted-foreground">
              Control how your information appears in the member directory.
            </p>
            <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={privacyDirectoryVisible}
                onChange={(e) => setPrivacyDirectoryVisible(e.target.checked)}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Show in member directory</p>
                <p className="text-xs text-muted-foreground">
                  Other members can find your name and specialization
                </p>
              </div>
            </label>
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  onClick={handleComplete}
                  disabled={updatePerson.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {updatePerson.isPending ? 'Saving...' : 'Complete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
