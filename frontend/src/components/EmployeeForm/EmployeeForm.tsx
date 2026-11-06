import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Department } from '../../types/employee'
import type { EmployeeFormField, EmployeeFormValues } from '../../utils/employee-form'
import { validateEmployeeForm } from '../../utils/employee-form'
import type { FieldErrors } from '../../utils/form-errors'
import { hasErrors } from '../../utils/form-errors'
import { Alert } from '../Alert'
import { Button } from '../Button'
import { SelectField } from '../SelectField'
import { TextField } from '../TextField'

interface EmployeeFormProps {
  mode: 'create' | 'edit'
  initialValues: EmployeeFormValues
  departments: Department[]
  /** Called with valid values; the page sends them to the API. */
  onSubmit: (values: EmployeeFormValues) => void
  onCancel: () => void
  submitting: boolean
  /** Errors from the server, per field and for the whole form. */
  serverErrors?: FieldErrors<EmployeeFormField>
  formError?: string | null
}

const ROLE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'ADMIN', label: 'HR admin' },
]

/** Employee profile form, shared by the create and edit pages. */
export function EmployeeForm({
  mode,
  initialValues,
  departments,
  onSubmit,
  onCancel,
  submitting,
  serverErrors = {},
  formError = null,
}: EmployeeFormProps) {
  const [values, setValues] = useState(initialValues)
  const [clientErrors, setClientErrors] = useState<FieldErrors<EmployeeFormField>>({})
  // Server errors show until the user edits that field again.
  const [editedSinceSubmit, setEditedSinceSubmit] = useState<Set<EmployeeFormField>>(new Set())

  const errorFor = (field: EmployeeFormField) =>
    clientErrors[field] ?? (editedSinceSubmit.has(field) ? undefined : serverErrors[field])

  function set<K extends EmployeeFormField>(field: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setClientErrors((current) => ({ ...current, [field]: undefined }))
    setEditedSinceSubmit((current) => new Set(current).add(field))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateEmployeeForm(values)
    setClientErrors(errors)
    setEditedSinceSubmit(new Set())
    if (!hasErrors(errors)) onSubmit(values)
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Full name"
          value={values.full_name}
          onChange={(event) => set('full_name', event.target.value)}
          error={errorFor('full_name')}
          autoComplete="off"
          maxLength={150}
          autoFocus
        />
        <TextField
          label="Work email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
          error={errorFor('email')}
          hint={mode === 'create' ? 'Also their login.' : 'Changing it also changes their login email.'}
          autoComplete="off"
          maxLength={255}
        />
        <TextField
          label="Phone (optional)"
          type="tel"
          inputMode="tel"
          placeholder="+62 812-3456-7890"
          value={values.phone}
          onChange={(event) => set('phone', event.target.value)}
          error={errorFor('phone')}
          autoComplete="off"
          maxLength={20}
        />
        <TextField
          label="Position"
          value={values.position}
          onChange={(event) => set('position', event.target.value)}
          error={errorFor('position')}
          autoComplete="off"
          maxLength={100}
        />
        <SelectField
          label="Department"
          placeholder="Choose a department"
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
          value={values.department_id}
          onChange={(event) => set('department_id', event.target.value)}
          error={errorFor('department_id')}
        />
        <TextField
          label="Hire date"
          type="date"
          value={values.hire_date}
          onChange={(event) => set('hire_date', event.target.value)}
          error={errorFor('hire_date')}
        />
        {mode === 'create' && (
          <SelectField
            label="Role"
            options={ROLE_OPTIONS}
            value={values.role}
            onChange={(event) => set('role', event.target.value === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE')}
            error={errorFor('role')}
            hint="HR admins can manage employees and see everyone's attendance."
          />
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? (submitting ? 'Creating…' : 'Create employee') : submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
