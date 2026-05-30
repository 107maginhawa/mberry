/**
 * Typed fetch wrapper for API calls.
 * All requests include credentials and JSON handling.
 */

import { CSRF_HEADER, isStateChangingMethod, readCsrfCookie } from '@monobase/sdk-ts/csrf'

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
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
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
