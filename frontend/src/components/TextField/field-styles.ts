import { cx } from '../../utils/cx'

/** The look of a text input or select, with the red state for errors. Shared by TextField and SelectField. */
export function fieldControlClasses({ invalid, className }: { invalid: boolean; className?: string }): string {
  return cx(
    'min-h-11 w-full rounded-lg border bg-surface px-3.5 text-ink transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:ring-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-65',
    invalid ? 'border-danger focus:ring-danger-ring' : 'border-line-strong focus:border-primary focus:ring-focus-ring',
    className,
  )
}

export const FIELD_LABEL_CLASSES = 'text-sm font-semibold text-ink'
export const FIELD_ERROR_CLASSES = 'text-[0.8125rem] text-danger'
export const FIELD_HINT_CLASSES = 'text-[0.8125rem] text-ink-muted'
