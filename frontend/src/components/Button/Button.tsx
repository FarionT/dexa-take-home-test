import type { ButtonHTMLAttributes } from 'react'
import { buttonClasses } from './button-styles'
import type { ButtonVariant } from './button-styles'
import { Spinner } from '../Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Shows a spinner and disables the button (e.g. while a request runs). */
  loading?: boolean
  fullWidth?: boolean
}

/** Variants and classes live in button-styles.ts, so links can look like buttons too. */
export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={buttonClasses({ variant, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner size="sm" label="Please wait" />}
      <span>{children}</span>
    </button>
  )
}
