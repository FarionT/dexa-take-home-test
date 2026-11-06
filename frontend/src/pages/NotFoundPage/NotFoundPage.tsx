import { useNavigate } from 'react-router'
import { FullPageMessage } from '../../components'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <FullPageMessage
      title="Page not found"
      description="The page you're looking for doesn't exist."
      action={{ label: 'Go to home', onClick: () => navigate('/') }}
    />
  )
}
