/**
 * Standardized error message extraction for API errors.
 *
 * Usage in mutations:
 *   onError: (err) => toast.error(extractErrorMessage(err, 'Payment failed'))
 *
 * Usage in try-catch:
 *   catch (err) { toast.error(extractErrorMessage(err, 'Upload failed')) }
 */

interface ApiErrorShape {
  body?: { error?: string; message?: string }
  message?: string
}

/**
 * Extract a user-facing error message from an API error.
 * Checks err.body.error, err.body.message, err.message in order.
 * Falls back to the provided default message.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback

  const apiErr = err as ApiErrorShape

  // SDK errors put the server message in body.error or body.message
  if (apiErr.body?.error) return apiErr.body.error
  if (apiErr.body?.message) return apiErr.body.message

  // Standard Error objects
  if (apiErr.message) return apiErr.message

  return fallback
}
