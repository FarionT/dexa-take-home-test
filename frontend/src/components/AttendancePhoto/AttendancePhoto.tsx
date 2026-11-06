import { useEffect } from 'react'
import { useRequest } from '../../hooks/useRequest'
import { getAttendancePhoto } from '../../services/attendance.service'
import { cx } from '../../utils/cx'
import { Button } from '../Button'
import { Spinner } from '../Spinner'

interface AttendancePhotoProps {
  /** `photo.url` from the API. */
  url: string
  alt: string
  className?: string
}

/**
 * Shows an attendance photo. The photo endpoint needs the token, which an
 * <img src> can't send, so the image is loaded through the API client as a
 * Blob and shown from an object URL (freed again when no longer shown).
 */
export function AttendancePhoto({ url, alt, className }: AttendancePhotoProps) {
  const photo = useRequest(`attendance-photo:${url}`, async () => URL.createObjectURL(await getAttendancePhoto(url)))
  const objectUrl = photo.data

  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  const frame = cx('flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted', className)

  if (photo.error) {
    return (
      <div className={frame}>
        <div className="flex flex-col items-center gap-2 px-4 text-center text-sm">
          <p>{photo.error.message}</p>
          <Button variant="secondary" onClick={photo.reload}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (!objectUrl) {
    return (
      <div className={frame}>
        <Spinner label="Loading photo" />
      </div>
    )
  }
  return (
    <div className={frame}>
      <img src={objectUrl} alt={alt} className="size-full object-cover" />
    </div>
  )
}
