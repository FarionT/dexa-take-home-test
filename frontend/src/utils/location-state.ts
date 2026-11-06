import { isRecord } from '../types/api'

// Router location state is `unknown` at runtime (it survives reloads and can be
// anything), so it is read through these checks instead of a type cast.

/** Where the user wanted to go before being sent to /login. */
export function redirectFrom(state: unknown): string | undefined {
  return isRecord(state) && typeof state.from === 'string' ? state.from : undefined
}

/** A one-time success message passed to the next page, e.g. after changing the password. */
export function flashMessage(state: unknown): string | undefined {
  return isRecord(state) && typeof state.flash === 'string' ? state.flash : undefined
}
