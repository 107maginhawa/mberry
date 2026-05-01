import { createFileRoute } from '@tanstack/react-router'
import { AuthView } from '@daveyplate/better-auth-ui'

export const Route = createFileRoute('/auth/$authView')({
  component: AuthPage,
})

function AuthPage() {
  const { authView } = Route.useParams()
  const callbackURL = globalThis.location.origin

  return (
    <main className="h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#554B68]">Memberry</h1>
        </div>
        <AuthView pathname={authView} callbackURL={callbackURL} />
      </div>
    </main>
  )
}
