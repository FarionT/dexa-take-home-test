import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import type { Role } from '../../types/auth'
import { cx } from '../../utils/cx'
import { ROLE_LABEL } from '../../utils/labels'
import { Badge } from '../Badge'
import { Brand } from '../Brand'
import { Button } from '../Button'

interface AppLayoutProps {
  title: string
  description?: ReactNode
  /** Buttons or links next to the title, e.g. "Add employee". */
  actions?: ReactNode
  /** A small link above the title, e.g. back to the list. */
  back?: { to: string; label: string }
  children: ReactNode
}

interface NavItem {
  to: string
  label: string
  roles: Role[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/employees', label: 'Employees', roles: ['ADMIN'] },
]

/** The page frame for logged-in pages: header with navigation and account, then the page title and content. */
export function AppLayout({ title, description, actions, back, children }: AppLayoutProps) {
  const { state, logout } = useAuth()
  if (state.status !== 'authenticated') return null // only rendered inside RequireAuth
  const { user } = state

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Brand />
            <nav className="flex gap-1" aria-label="Main">
              {NAV.filter((item) => item.roles.includes(user.role)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cx(
                      'rounded-md px-3 py-1.5 text-sm font-semibold no-underline',
                      isActive ? 'bg-primary-soft text-primary-strong' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm" aria-label="Account">
            <span className="break-all text-ink-muted">{user.email}</span>
            <Badge tone={user.role === 'ADMIN' ? 'primary' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>
            <Link className="font-semibold" to="/change-password">
              Change password
            </Link>
            <Button variant="secondary" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
        <div className="flex flex-col gap-1">
          {back && (
            <Link to={back.to} className="mb-1 text-sm font-semibold no-underline hover:underline">
              ← {back.label}
            </Link>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl">{title}</h1>
              {description && <div className="mt-1.5 text-ink-muted">{description}</div>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
