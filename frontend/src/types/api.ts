/**
 * Every backend response body: { status, message, data? }.
 * See backend/docs/api/auth.md → Response format.
 */
export interface ApiResponse {
  status: number
  message: string
  data?: unknown
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isApiResponse(value: unknown): value is ApiResponse {
  return isRecord(value) && typeof value.status === 'number' && typeof value.message === 'string'
}

/** `data.errors` of a 400 "Validation failed" response, or [] for any other response. */
export function validationErrorsOf(data: unknown): string[] {
  if (!isRecord(data) || !Array.isArray(data.errors)) return []
  return data.errors.filter((error): error is string => typeof error === 'string')
}
