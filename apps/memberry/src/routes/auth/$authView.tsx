import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AuthView } from '@daveyplate/better-auth-ui'

// oli-ui: exempt-pageshell — pre-auth flow uses better-auth-ui's own chrome
export const Route = createFileRoute('/auth/$authView')({
  component: AuthPage,
})

function AuthPage() {
  const { authView } = Route.useParams()

  // better-auth-ui renders a few iconic icon-only buttons (password
  // visibility toggle, captcha placeholder, etc.) without aria-label.
  // axe-core flags those as button-name violations on every auth page.
  // Patch them post-mount with a MutationObserver — pure-presentational
  // fix, no functional change.
  useEffect(() => {
    const label = (btn: HTMLButtonElement) => {
      if (btn.getAttribute('aria-label')) return
      if (btn.textContent && btn.textContent.trim().length > 0) return
      const icon = btn.querySelector('svg, [aria-label]')
      if (icon) {
        const iconLabel = icon.getAttribute('aria-label')
        if (iconLabel) {
          btn.setAttribute('aria-label', iconLabel)
          return
        }
      }
      btn.setAttribute('aria-label', 'auth action')
    }
    const patch = () => {
      document.querySelectorAll<HTMLButtonElement>('button').forEach(label)
    }
    patch()
    const obs = new MutationObserver(patch)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [authView])

  // Define headers for known auth paths
  const authHeaders = {
    'sign-in': {
      title: 'Welcome back',
      subtitle: 'Sign in to your Memberry account',
    },
    'sign-up': {
      title: 'Create an account',
      subtitle: 'Join Memberry today',
    },
    'forgot-password': {
      title: 'Reset your password',
      subtitle: "We'll send you a reset link",
    },
    'verify-email': {
      title: 'Verify your email',
      subtitle: 'Check your inbox for the verification link',
    },
    'two-factor': {
      title: 'Two-factor authentication',
      subtitle: 'Enter your verification code',
    },
  }

  // Get header content for current auth view (undefined for unknown paths)
  const headerContent = authHeaders[authView as keyof typeof authHeaders]

  // callback URL
  const callbackURL = globalThis.location.origin

  return (
    <main className="h-screen overflow-y-auto flex items-center justify-center bg-background py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        {headerContent && (
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <h1 className="text-h1 text-[var(--color-primary)]">Memberry</h1>
            </div>
            <h2 className="text-h2 text-foreground">{headerContent.title}</h2>
            <p className="subtitle text-muted-foreground mt-2">
              {headerContent.subtitle}
            </p>
          </div>
        )}
        <div className="w-full overflow-hidden flex justify-center text-center [&_.flex.items-center.gap-2]:justify-center">
          <AuthView pathname={authView} callbackURL={callbackURL} />
        </div>
      </div>
    </main>
  )
}
