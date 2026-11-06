import { useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import { FIELD_ERROR_CLASSES, FIELD_HINT_CLASSES, FIELD_LABEL_CLASSES, fieldControlClasses } from '../TextField/field-styles'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  label: string
  options: SelectOption[]
  /** A first, empty choice such as "Choose a department" or "All departments". */
  placeholder?: string
  error?: string
  hint?: ReactNode
}

/** A labelled <select> with the same look and error handling as TextField. */
export function SelectField({ label, options, placeholder, error, hint, className, ...rest }: SelectFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ')

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label className={FIELD_LABEL_CLASSES} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={fieldControlClasses({ invalid: Boolean(error), className: 'cursor-pointer pr-8' })}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
      {hint && (
        <div id={hintId} className={FIELD_HINT_CLASSES}>
          {hint}
        </div>
      )}
    </div>
  )
}
