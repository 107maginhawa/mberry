/**
 * Standardized error message extraction for API errors.
 *
 * Usage in mutations:
 *   onError: (err) => toast.error('Failed to X', { description: extractErrorMessage(err, 'Please try again.') })
 *
 * Usage in try-catch:
 *   catch (err) { toast.error(extractErrorMessage(err, 'Upload failed')) }
 *
 * Handles two server error shapes (see docs/product/ERROR_TAXONOMY.md):
 *   - flat:   { message, code }                 (current runtime shape)
 *   - nested: { error: { message, code } }      (taxonomy-documented shape)
 * When a taxonomy code is present it is appended, e.g. "Fund allocation… (M06-010)".
 */

interface ErrorPayload {
  error?: string | { code?: string; message?: string }
  message?: string
  code?: string
}

interface ApiErrorShape extends ErrorPayload {
  // Both our `api` wrapper (ApiError.body) and the SDK transport stash the parsed JSON body here
  body?: ErrorPayload
}

/** Pull a user-facing message (with taxonomy code when available) from a single payload object. */
function fromPayload(payload: ErrorPayload | undefined): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined

  // Nested taxonomy object: { error: { code, message } }
  if (typeof payload.error === 'object' && payload.error?.message) {
    const { code, message } = payload.error
    return code ? `${message} (${code})` : message
  }

  // Plain-string error field
  if (typeof payload.error === 'string') return payload.error

  // Flat shape: { message, code }
  if (payload.message) {
    return payload.code ? `${payload.message} (${payload.code})` : payload.message
  }

  return undefined
}

/**
 * Extract a user-facing error message from an API error, falling back to `fallback`.
 * Prefers the parsed response body over the generic Error message (e.g. "400 Bad Request").
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback

  const apiErr = err as ApiErrorShape

  return fromPayload(apiErr.body) ?? fromPayload(apiErr) ?? fallback
}
