import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AppLayout, Button, Dialog, EmployeeForm, Spinner, TemporaryPasswordNotice } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { createEmployee, listDepartments } from '../../services/employee.service'
import type { CreatedEmployee } from '../../types/employee'
import type { EmployeeFormField, EmployeeFormValues } from '../../utils/employee-form'
import { emptyEmployeeForm, employeeFormErrors, toCreateRequest } from '../../utils/employee-form'
import type { FormErrors } from '../../utils/form-errors'
import { todayIsoDate } from '../../utils/format'

const NO_ERRORS: FormErrors<EmployeeFormField> = { fields: {}, form: null }

/** HR adds an employee. Their login is created at the same time; its temporary password is shown once. */
export function EmployeeCreatePage() {
  const navigate = useNavigate()
  const departments = useRequest('departments', listDepartments)
  const [initialValues] = useState(() => emptyEmployeeForm(todayIsoDate()))
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState(NO_ERRORS)
  const [created, setCreated] = useState<CreatedEmployee | null>(null)

  async function handleSubmit(values: EmployeeFormValues) {
    setSubmitting(true)
    setErrors(NO_ERRORS)
    try {
      setCreated(await createEmployee(toCreateRequest(values)))
    } catch (error: unknown) {
      setErrors(employeeFormErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  function goToEmployee() {
    if (created) navigate(`/employees/${created.employee.id}`, { replace: true })
  }

  return (
    <AppLayout
      title="Add employee"
      description="A login is created too. You'll get a temporary password to give them."
      back={{ to: '/employees', label: 'Employees' }}
    >
      {departments.error && (
        <Alert tone="error" title="Couldn't load departments">
          <p>{departments.error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={departments.reload}>
            Try again
          </Button>
        </Alert>
      )}
      {!departments.data && departments.loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading" />
        </div>
      )}
      {departments.data && (
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <EmployeeForm
            mode="create"
            initialValues={initialValues}
            departments={departments.data}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/employees')}
            submitting={submitting}
            serverErrors={errors.fields}
            formError={errors.form}
          />
        </div>
      )}

      <Dialog
        open={created !== null}
        title={created ? `${created.employee.full_name} was added (${created.employee.employee_code})` : ''}
        onClose={goToEmployee}
        footer={<Button onClick={goToEmployee}>Done, go to employee</Button>}
      >
        {created && <TemporaryPasswordNotice password={created.temporary_password} recipient={created.employee.full_name} />}
      </Dialog>
    </AppLayout>
  )
}
