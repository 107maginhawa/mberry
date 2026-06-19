/**
 * Typed fetch wrapper for API calls.
 * All requests include credentials and JSON handling.
 */

import { CSRF_HEADER, isStateChangingMethod, readCsrfCookie } from '@monobase/sdk-ts/csrf'
import { getSdkOrgId } from '@monobase/sdk-ts/client'

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const csrfHeader: Record<string, string> = {}
  if (isStateChangingMethod(method)) {
    const token = readCsrfCookie()
    if (token) csrfHeader[CSRF_HEADER] = token
  }
  // Org-scoped routes resolve tenant from x-org-id; inject the active org so
  // raw api-lib calls match the SDK behaviour (a per-call header still wins).
  const orgId = getSdkOrgId()
  const orgHeader: Record<string, string> = orgId ? { 'x-org-id': orgId } : {}
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
      ...orgHeader,
      ...options.headers,
    },
  })

  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    throw new ApiError(
      `${res.status} ${res.statusText}`,
      res.status,
      body,
    )
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T = unknown>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),

  post: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers }),

  put: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers }),

  patch: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers }),

  delete: <T = unknown>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', headers }),
}

export { ApiError }
