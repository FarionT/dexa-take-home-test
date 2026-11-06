import axios, { isAxiosError } from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '../config'
import { isApiResponse, validationErrorsOf } from '../types/api'
import { loadToken } from './token-storage'

const REQUEST_TIMEOUT_MS = 15_000
const UNREACHABLE = 'Cannot reach the server. Check your connection and try again.'
const TIMED_OUT = 'The server took too long to respond. Please try again.'
const UNEXPECTED_RESPONSE = 'Unexpected response from the server. Please try again.'

/** Any failed request. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  readonly status: number
  /** One entry per problem for a 400 "Validation failed", otherwise empty. */
  readonly errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/** The one axios instance for the backend gateway. Use it only from services/. */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

// Every request carries the stored token, if there is one.
api.interceptors.request.use((config) => {
  const token = loadToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

type UnauthorizedHandler = (message: string) => void
let onUnauthorized: UnauthorizedHandler | undefined

/**
 * Called when a request sent *with* a token gets 401 (expired or ended session).
 * Registered by AuthProvider to log the user out. A 401 on login (wrong
 * password) carries no token, so it doesn't trigger this.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  onUnauthorized = handler
}

api.interceptors.response.use(undefined, (error: unknown) => {
  if (isAxiosError(error) && error.response?.status === 401 && error.config?.headers.has('Authorization')) {
    const body = error.response.data
    onUnauthorized?.(isApiResponse(body) ? body.message : 'Your session has ended. Please log in again.')
  }
  return Promise.reject(error)
})

/**
 * Sends a request and returns `data` from the { status, message, data } envelope.
 * `parse` checks the shape of `data` at runtime (see parseWith), so a backend
 * change can't slip through as a wrong type. Every failure becomes an ApiError.
 */
export async function request<T>(config: AxiosRequestConfig, parse: (data: unknown) => T): Promise<T> {
  try {
    const response = await api.request<unknown>(config)
    if (!isApiResponse(response.data)) throw new ApiError(response.status, UNEXPECTED_RESPONSE)
    return parse(response.data.data)
  } catch (error: unknown) {
    throw toApiError(error)
  }
}

/**
 * For endpoints that return a file instead of JSON (e.g. an attendance photo).
 * Errors still arrive as the JSON envelope, but inside a Blob, so they are
 * read back as JSON first and then become an ApiError like any other request.
 */
export async function requestBlob(config: AxiosRequestConfig): Promise<Blob> {
  try {
    const response = await api.request<Blob>({ ...config, responseType: 'blob' })
    return response.data
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      const body = await readJson(error.response.data)
      throw isApiResponse(body)
        ? new ApiError(body.status, body.message, validationErrorsOf(body.data))
        : new ApiError(error.response.status, UNEXPECTED_RESPONSE)
    }
    throw toApiError(error)
  }
}

async function readJson(blob: Blob): Promise<unknown> {
  try {
    const parsed: unknown = JSON.parse(await blob.text())
    return parsed
  } catch {
    return undefined // not JSON: reported as an unexpected response
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (!isAxiosError(error)) return new ApiError(0, 'Something went wrong. Please try again.')

  // No response: network down, server not running, CORS blocked, or timeout.
  if (!error.response) {
    return new ApiError(0, error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ? TIMED_OUT : UNREACHABLE)
  }
  const body = error.response.data
  return isApiResponse(body)
    ? new ApiError(body.status, body.message, validationErrorsOf(body.data))
    : new ApiError(error.response.status, UNEXPECTED_RESPONSE)
}

/** Builds a `parse` function from a type guard. */
export function parseWith<T>(guard: (value: unknown) => value is T, what: string): (data: unknown) => T {
  return (data) => {
    if (!guard(data)) throw new ApiError(500, `Unexpected ${what} from the server. Please try again.`)
    return data
  }
}
