import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'

interface DialogProps {
  open: boolean
  title: string
  /** Called when the user closes it (Esc, or a button that calls it). */
  onClose: () => void
  children: ReactNode
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode
  /** 'lg' for content that needs room, e.g. photos side by side. */
  size?: 'md' | 'lg'
}

// One width class per size (two width classes would be resolved by Tailwind's CSS order).
const SIZE_CLASSES: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'w-[min(32rem,calc(100%-2rem))]',
  lg: 'w-[min(48rem,calc(100%-2rem))]',
}

/**
 * A modal built on the native <dialog>: the browser handles the backdrop,
 * focus trapping and Esc. `open` drives showModal()/close() through a ref.
 */
export function Dialog({ open, title, onClose, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={cx('m-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50', SIZE_CLASSES[size])}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg">
            {title}
          </h2>
          <div className="text-sm text-ink-muted">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
