import { cx } from '../../utils/cx'

interface SpinnerProps {
  size?: 'sm' | 'md'
  /** Read by screen readers; the spinner itself is decorative. */
  label?: string
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'size-4 border-2',
  md: 'size-8 border-3 text-primary',
}

export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      className={cx(
        'inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent motion-reduce:[animation-duration:2s]',
        SIZE_CLASSES[size],
      )}
    >
      <span className="sr-only">{label}</span>
    </span>
  )
}
