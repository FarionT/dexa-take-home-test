import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/http'

interface Settled<T> {
  key: string
  data?: T
  error?: ApiError
}

export interface RequestState<T> {
  /** The latest data. Kept while a new request with another key loads (no flicker when paging). */
  data: T | undefined
  /** The error of the current request, if it failed. */
  error: ApiError | undefined
  loading: boolean
  /** Runs the current request again (e.g. after a change or a "Try again" click). */
  reload: () => void
}

/**
 * Loads data for a component. `key` identifies the request: when it changes,
 * `load` runs again; `null` skips loading. Results of outdated requests are ignored.
 *
 * "loading" is derived (the latest result belongs to another key) instead of
 * being set inside the effect, which the React lint rules forbid.
 */
export function useRequest<T>(key: string | null, load: () => Promise<T>): RequestState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [lastData, setLastData] = useState<T | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const requestKey = key === null ? null : `${key}#${attempt}`

  // Always call the latest `load` without making it an effect dependency.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (requestKey === null) return
    let cancelled = false
    loadRef.current().then(
      (data) => {
        if (cancelled) return
        setSettled({ key: requestKey, data })
        setLastData(data)
      },
      (error: unknown) => {
        if (cancelled) return
        setSettled({
          key: requestKey,
          error: error instanceof ApiError ? error : new ApiError(0, 'Something went wrong. Please try again.'),
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [requestKey])

  const current = settled && settled.key === requestKey ? settled : null
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    data: current?.data ?? lastData,
    error: current?.error,
    loading: requestKey !== null && current === null,
    reload,
  }
}
