import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils/cx'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /** Shown under the field in red; also marks the field invalid for screen readers. */
  error?: string
  /** Shown under the field (below the error, if any), e.g. format rules. */
  hint?: ReactNode
  /** For type="password": adds a Show / Hide button. */
  revealable?: boolean
}

export function TextField({ label, error, hint, revealable = false, type = 'text', className, ...rest }: TextFieldProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ')
  const inputType = revealable && revealed ? 'text' : type

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label className="text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      <div className="relative flex">
        <input
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(
            'min-h-11 w-full rounded-lg border bg-surface px-3.5 text-ink transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:ring-3 focus:outline-none',
            error
              ? 'border-danger focus:ring-danger-ring'
              : 'border-line-strong focus:border-primary focus:ring-focus-ring',
            revealable && 'pr-17',
          )}
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={revealed}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md px-2.5 py-1.5 text-[0.8125rem] font-semibold text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
      {hint && (
        <div id={hintId} className="text-[0.8125rem] text-ink-muted">
          {hint}
        </div>
      )}
    </div>
  )
}
