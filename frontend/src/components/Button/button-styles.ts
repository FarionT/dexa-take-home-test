import { cx } from '../../utils/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

// Each variant sets its own border color: two classes for the same property
// (e.g. border-transparent + border-line-strong) are resolved by Tailwind's CSS
// order, not by their order in className, so the base must not set one.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-primary text-on-primary enabled:hover:bg-primary-hover',
  secondary: 'border-line-strong bg-surface text-ink enabled:hover:bg-surface-muted',
  ghost: 'border-transparent bg-transparent text-ink-muted enabled:hover:bg-surface-muted enabled:hover:text-ink',
  danger: 'border-danger-line bg-danger-bg text-danger-ink enabled:hover:border-danger',
}

/** Button look, also for links that act as buttons: <Link className={buttonClasses({ variant: 'primary' })} />. */
export function buttonClasses({
  variant = 'primary',
  fullWidth = false,
  className,
}: { variant?: ButtonVariant; fullWidth?: boolean; className?: string } = {}): string {
  return cx(
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4.5 font-semibold no-underline transition-colors',
    'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-65',
    VARIANT_CLASSES[variant],
    fullWidth && 'w-full',
    className,
  )
}
