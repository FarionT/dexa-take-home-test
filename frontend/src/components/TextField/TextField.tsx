import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils/cx'
import { fieldControlClasses } from './field-styles'

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
          className={fieldControlClasses({ invalid: Boolean(error), className: revealable ? 'pr-17' : undefined })}
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
