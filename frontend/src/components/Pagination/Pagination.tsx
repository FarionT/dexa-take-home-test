import { Button } from '../Button'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, totalPages, total, onPageChange, disabled = false }: PaginationProps) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted" aria-label="Pagination">
      <p>
        Page <strong className="text-ink">{Math.min(page, Math.max(totalPages, 1))}</strong> of{' '}
        <strong className="text-ink">{Math.max(totalPages, 1)}</strong> · {total} {total === 1 ? 'result' : 'results'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}
