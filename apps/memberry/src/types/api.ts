/** Shared API response/error types to avoid as-any casts */

export interface ApiListResponse<T> {
  data: T[]
  total?: number
  page?: number
  limit?: number
}

export interface ApiErrorBody {
  error?: string
  message?: string
  statusCode?: number
}
