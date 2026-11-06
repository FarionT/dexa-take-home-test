import { ApiError } from '../services/http'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

export interface FormErrors<Field extends string> {
  fields: FieldErrors<Field>
  /** Errors that belong to no single field, shown above the form. */
  form: string | null
}

/**
 * Splits an API error into per-field messages and a form message. Backend
 * validation messages start with the field name ("email must be a valid email
 * address"), so they are matched to fields by that prefix.
 */
export function toFormErrors<Field extends string>(error: unknown, fields: readonly Field[]): FormErrors<Field> {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: 'Something went wrong. Please try again.' }
  }
  if (error.errors.length === 0) {
    return { fields: {}, form: error.message }
  }

  const result: FormErrors<Field> = { fields: {}, form: null }
  const unmatched: string[] = []
  for (const message of error.errors) {
    const field = fields.find((name) => message.startsWith(`${name} `))
    if (field && !result.fields[field]) result.fields[field] = capitalize(message)
    else if (!field) unmatched.push(message)
  }
  if (unmatched.length > 0) result.form = unmatched.map(capitalize).join('. ')
  return result
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** True when there is at least one message. */
export function hasErrors<Field extends string>(fields: FieldErrors<Field>): boolean {
  return Object.values(fields).some(Boolean)
}
