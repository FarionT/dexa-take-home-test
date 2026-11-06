import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, AppLayout, Button, EmployeeForm, Spinner } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { getEmployee, listDepartments, updateEmployee } from '../../services/employee.service'
import type { EmployeeFormField, EmployeeFormValues } from '../../utils/employee-form'
import { employeeFormErrors, employeeToFormValues, toUpdateRequest } from '../../utils/employee-form'
import type { FormErrors } from '../../utils/form-errors'

const NO_ERRORS: FormErrors<EmployeeFormField> = { fields: {}, form: null }

/** HR edits the profile fields. Status and role are account actions on the detail page. */
export function EmployeeEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const employee = useRequest(`employee:${id}`, () => getEmployee(id))
  const departments = useRequest('departments', listDepartments)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState(NO_ERRORS)
  const detailPath = `/employees/${id}`

  async function handleSubmit(values: EmployeeFormValues) {
    if (!employee.data) return
    const changes = toUpdateRequest(values, employee.data)
    if (Object.keys(changes).length === 0) {
      setErrors({ fields: {}, form: 'Nothing has changed.' })
      return
    }
    setSubmitting(true)
    setErrors(NO_ERRORS)
    try {
      await updateEmployee(id, changes)
      navigate(detailPath, { replace: true, state: { flash: 'Profile updated.' } })
    } catch (error: unknown) {
      setErrors(employeeFormErrors(error))
      setSubmitting(false)
    }
  }

  const loadError = employee.error ?? departments.error

  return (
    <AppLayout
      title={employee.data ? `Edit ${employee.data.full_name}` : 'Edit employee'}
      description={employee.data?.employee_code}
      back={{ to: detailPath, label: 'Back to employee' }}
    >
      {loadError && (
        <Alert tone="error" title={loadError.status === 404 ? 'Employee not found' : "Couldn't load the employee"}>
          <p>{loadError.status === 404 ? 'It may have been deleted.' : loadError.message}</p>
          {loadError.status !== 404 && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                employee.reload()
                departments.reload()
              }}
            >
              Try again
            </Button>
          )}
        </Alert>
      )}
      {!loadError && (!employee.data || !departments.data) && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading" />
        </div>
      )}
      {!loadError && employee.data && departments.data && (
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <EmployeeForm
            key={employee.data.updated_at}
            mode="edit"
            initialValues={employeeToFormValues(employee.data)}
            departments={departments.data}
            onSubmit={handleSubmit}
            onCancel={() => navigate(detailPath)}
            submitting={submitting}
            serverErrors={errors.fields}
            formError={errors.form}
          />
        </div>
      )}
    </AppLayout>
  )
}
