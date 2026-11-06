import type { ReactNode } from 'react'
import { Brand } from '../Brand'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/** The centered card used by the login and change-password pages. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[image:var(--page-accent)] px-4 py-6">
      <div className="w-full max-w-[26rem] rounded-xl border border-line bg-surface px-5 py-6 shadow-card sm:px-7 sm:py-8">
        <Brand className="mb-7" />
        <header className="mb-6">
          <h1 className="text-2xl">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
        </header>
        {children}
      </div>
    </main>
  )
}
