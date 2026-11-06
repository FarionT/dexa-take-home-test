import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import { Spinner } from '../Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Shows a spinner and disables the button (e.g. while a request runs). */
  loading?: boolean
  fullWidth?: boolean
}

// Each variant sets its own border color: two classes for the same property
// (e.g. border-transparent + border-line-strong) are resolved by Tailwind's CSS
// order, not by their order in className, so the base must not set one.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'border-transparent bg-primary text-on-primary enabled:hover:bg-primary-hover',
  secondary: 'border-line-strong bg-surface text-ink enabled:hover:bg-surface-muted',
  ghost: 'border-transparent bg-transparent text-ink-muted enabled:hover:bg-surface-muted enabled:hover:text-ink',
}

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
      className={cx(
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4.5 font-semibold transition-colors',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-65',
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size="sm" label="Please wait" />}
      <span>{children}</span>
    </button>
  )
}
