/**
 * Typed SDK mock envelope helpers.
 *
 * hey-api returns { data, error, request, response } (ThrowOnError=false, style='fields').
 * These helpers build that envelope so `vi.mocked(fn).mockResolvedValue(ok<XResponse>({...}))`
 * type-checks the data payload against the generated SDK response type.
 *
 * Usage:
 *   - TRUSTWORTHY endpoints: ok<XResponse>({ ...real shape... })
 *   - DRIFT endpoints (generated type lies vs handler): ok({ ...handler shape... } as any)
 *     with a one-line comment explaining the drift.
 *   - Error case: err(status, { error: 'message' })
 */

/** Build the hey-api success envelope for a mocked SDK fn. */
export function ok<T>(
  data: T,
  status = 200,
): { data: T; error: undefined; request: Request; response: Response } {
  return {
    data,
    error: undefined,
    request: new Request('http://t'),
    response: new Response('', { status }),
  }
}

/** Build a failure envelope (data undefined, error body present, non-2xx). */
export function err(
  status: number,
  error?: unknown,
): { data: undefined; error: unknown; request: Request; response: Response } {
  return {
    data: undefined,
    error,
    request: new Request('http://t'),
    response: new Response(JSON.stringify(error ?? {}), { status }),
  }
}
