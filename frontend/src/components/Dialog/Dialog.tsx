import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  /** Called when the user closes it (Esc, or a button that calls it). */
  onClose: () => void
  children: ReactNode
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode
}

/**
 * A modal built on the native <dialog>: the browser handles the backdrop,
 * focus trapping and Esc. `open` drives showModal()/close() through a ref.
 */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
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
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50"
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
