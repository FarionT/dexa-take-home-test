import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  danger: 'bg-danger-bg text-danger-ink',
}

/** A small label, e.g. a status or role. */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap', TONE_CLASSES[tone])}>
      {children}
    </span>
  )
}
