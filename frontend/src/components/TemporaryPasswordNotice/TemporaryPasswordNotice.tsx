import { useState } from 'react'
import { Alert } from '../Alert'
import { Button } from '../Button'

interface TemporaryPasswordNoticeProps {
  password: string
  /** Who receives it, e.g. "Budi Santoso". */
  recipient: string
}

/**
 * Shows a newly generated password once. The backend only keeps a hash, so
 * it can't be shown again; HR must copy it now and hand it over.
 */
export function TemporaryPasswordNotice({ password, recipient }: TemporaryPasswordNoticeProps) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied('copied')
    } catch {
      // Clipboard can be blocked (permissions, non-secure page): the password is still selectable.
      setCopied('failed')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p>
        Give this temporary password to <strong className="text-ink">{recipient}</strong>. They must choose their own
        password at their first login.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-muted px-3.5 py-2.5 font-mono text-base tracking-wider text-ink select-all"
          aria-label="Temporary password"
        >
          {password}
        </code>
        <Button variant="secondary" onClick={copy}>
          {copied === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {copied === 'failed' && <p className="text-danger">Couldn't copy automatically. Select the password and copy it.</p>}
      <Alert tone="warning">This password is shown only once. It can't be displayed again, only reset.</Alert>
    </div>
  )
}
