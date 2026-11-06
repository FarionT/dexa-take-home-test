import { cx } from '../../utils/cx'

export const APP_NAME = 'Dexa Attendance'

/** The app logo and name, used in the auth card and the app header. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5 font-bold text-ink', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary" aria-hidden="true">
        D
      </span>
      {APP_NAME}
    </div>
  )
}
