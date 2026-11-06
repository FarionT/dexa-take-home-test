import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'

type Tone = 'error' | 'info' | 'success' | 'warning'

interface AlertProps {
  tone?: Tone
  title?: string
  children: ReactNode
}

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-danger-line bg-danger-bg text-danger-ink',
  info: 'border-info-line bg-info-bg text-info-ink',
  success: 'border-success-line bg-success-bg text-success-ink',
  warning: 'border-warning-line bg-warning-bg text-warning-ink',
}

/** A message box. Errors are announced to screen readers right away. */
export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg border px-4 py-3 text-sm', TONE_CLASSES[tone])}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}
