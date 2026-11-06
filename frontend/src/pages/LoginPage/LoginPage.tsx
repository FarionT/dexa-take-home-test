import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { Alert, AuthLayout, Button, TextField } from '../../components'
import { hasErrors, toFormErrors } from '../../utils/form-errors'
import type { FieldErrors } from '../../utils/form-errors'
import { looksLikeEmail } from '../../utils/password-rules'

const FIELDS = ['email', 'password'] as const
type Field = (typeof FIELDS)[number]

export function LoginPage() {
  const { state, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Why the user is here, e.g. "Your session has expired." Hidden once they try again.
  const notice = state.status === 'anonymous' && !formError ? state.notice : undefined

  function validate(): FieldErrors<Field> {
    const errors: FieldErrors<Field> = {}
    if (!email.trim()) errors.email = 'Email is required'
    else if (!looksLikeEmail(email)) errors.email = 'Enter a valid email address'
    if (!password) errors.password = 'Password is required'
    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      // On success GuestOnly redirects: to the page the user wanted, or to /change-password.
      await login(email, password)
    } catch (error: unknown) {
      const { fields, form } = toFormErrors(error, FIELDS)
      setFieldErrors(fields)
      setFormError(form)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Use your work email and password.">
      <form className="flex flex-col gap-4.5" onSubmit={handleSubmit} noValidate>
        {notice && <Alert tone="info">{notice}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}

        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          revealable
        />

        <Button type="submit" loading={submitting} fullWidth>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
        <p className="text-center text-sm text-ink-muted">Forgot your password? Ask HR to reset it.</p>
      </form>
    </AuthLayout>
  )
}
