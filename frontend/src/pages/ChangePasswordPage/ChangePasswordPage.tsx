import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Alert, AuthLayout, Button, TextField } from '../../components'
import { hasErrors, toFormErrors } from '../../utils/form-errors'
import type { FieldErrors } from '../../utils/form-errors'
import { checkPasswordRules } from '../../utils/password-rules'

const FIELDS = ['current_password', 'new_password', 'confirm_password'] as const
type Field = (typeof FIELDS)[number]

export function ChangePasswordPage() {
  const { state, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // RequireAuth only renders this page for logged-in users.
  const forced = state.status === 'authenticated' && state.user.must_change_password
  const rules = checkPasswordRules(newPassword)

  function validate(): FieldErrors<Field> {
    const errors: FieldErrors<Field> = {}
    if (!currentPassword) errors.current_password = `${forced ? 'Temporary' : 'Current'} password is required`
    if (!rules.every((rule) => rule.met)) errors.new_password = 'New password does not meet all the rules below'
    else if (newPassword === currentPassword) errors.new_password = 'New password must be different from the current one'
    if (confirmPassword !== newPassword) errors.confirm_password = 'Passwords do not match'
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
      await changePassword(currentPassword, newPassword)
      navigate('/', { replace: true, state: { flash: 'Your password has been changed.' } })
    } catch (error: unknown) {
      const { fields, form } = toFormErrors(error, FIELDS)
      // A wrong current password is a plain 400 message: show it on that field.
      if (form === 'Current password is incorrect') {
        setFieldErrors({ current_password: forced ? 'Temporary password is incorrect' : form })
      }
      else {
        setFieldErrors(fields)
        setFormError(form)
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={forced ? 'Set your own password' : 'Change password'}
      subtitle={forced ? undefined : 'Choose a new password for your account.'}
    >
      <form className="flex flex-col gap-4.5" onSubmit={handleSubmit} noValidate>
        {forced && (
          <Alert tone="warning">
            You're using a temporary password from HR. Choose your own password to continue.
          </Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}

        <TextField
          label={forced ? 'Temporary password' : 'Current password'}
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          error={fieldErrors.current_password}
          revealable
          autoFocus
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={fieldErrors.new_password}
          revealable
          hint={
            <ul className="mt-1 grid gap-0.5" aria-label="Password rules">
              {rules.map((rule) => (
                <li key={rule.id} className={rule.met ? 'text-success-ink' : 'text-ink-muted'}>
                  <span aria-hidden="true">{rule.met ? '✓' : '•'}</span> {rule.label}
                  <span className="sr-only">{rule.met ? ' (done)' : ' (not yet)'}</span>
                </li>
              ))}
            </ul>
          }
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirm_password}
          revealable
        />

        <Button type="submit" loading={submitting} fullWidth>
          {submitting ? 'Saving…' : 'Change password'}
        </Button>
        {forced ? (
          <Button variant="ghost" onClick={() => logout()} fullWidth>
            Log out
          </Button>
        ) : (
          <Link className="text-center text-sm text-ink-muted" to="/">
            Cancel
          </Link>
        )}
      </form>
    </AuthLayout>
  )
}
