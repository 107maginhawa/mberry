import { Link } from '@tanstack/react-router'

/**
 * Styled 404 used as the router-level `defaultNotFoundComponent` so every
 * route (officer area included) gets a real page instead of TanStack Router's
 * bare `<p>Not Found</p>` fallback.
 */
export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-[var(--color-bg)]">
      <h1 className="text-hero text-[var(--color-primary)]">404</h1>
      <p className="text-h3 text-[var(--color-text)]">Page not found</p>
      <p className="text-body-sm text-[var(--color-text-secondary)] max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-4 px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
      >
        Go home
      </Link>
    </div>
  )
}
