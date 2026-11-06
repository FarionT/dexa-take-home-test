import { Button } from '../Button'
import { Spinner } from '../Spinner'

interface FullPageMessageProps {
  title: string
  description?: string
  loading?: boolean
  action?: { label: string; onClick: () => void }
}

/** A centered message filling the page: loading, server unavailable, not found. */
export function FullPageMessage({ title, description, loading = false, action }: FullPageMessageProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {loading && <Spinner label={title} />}
      <h1 className="text-xl">{title}</h1>
      {description && <p className="max-w-md text-ink-muted">{description}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </main>
  )
}
