import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../Button'
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '../../utils/attendance'
import { formatFileSize } from '../../utils/format'

export interface CapturedPhoto {
  blob: Blob
  fileName: string
  /** 'upload' only when no camera could be used. */
  source: 'camera' | 'upload'
}

interface CameraCaptureProps {
  /** Called with the photo once taken, and with null when it is discarded (retake). */
  onChange: (photo: CapturedPhoto | null) => void
  disabled?: boolean
}

type CameraError = 'denied' | 'no-camera' | 'busy' | 'unsupported' | 'failed'

type CameraState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'live' }
  /** `fallback`: why an upload was used, to show again when the user picks another photo. */
  | { kind: 'captured'; previewUrl: string; source: CapturedPhoto['source']; fallback: CameraError | null }
  | { kind: 'error'; error: CameraError }

const ERROR_MESSAGE: Record<CameraError, string> = {
  denied: 'Camera access is blocked. Allow the camera for this site in your browser settings and try again, or upload a photo instead.',
  'no-camera': 'No camera was found on this device. Upload a photo instead.',
  busy: 'The camera is being used by another app. Close that app and try again, or upload a photo instead.',
  unsupported: "This browser can't open the camera here (it needs HTTPS or localhost). Upload a photo instead.",
  failed: "The camera couldn't be started. Try again, or upload a photo instead.",
}

/** Errors worth a "Try again": the user can fix them without reloading. */
const RETRYABLE: ReadonlySet<CameraError> = new Set(['denied', 'busy', 'failed'])

const JPEG_QUALITY = 0.9
const ACCEPT = PHOTO_TYPES.join(',')

/** Maps getUserMedia's DOMException names to what the user can do about them. */
function toCameraError(error: unknown): CameraError {
  if (!(error instanceof DOMException)) return 'failed'
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'denied'
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'no-camera'
  if (error.name === 'NotReadableError' || error.name === 'AbortError') return 'busy'
  return 'failed'
}

function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/**
 * Takes the attendance photo with the browser camera (getUserMedia): a live
 * preview, then "Take photo" draws the current frame into a JPEG. Uploading a
 * file is offered only when the camera can't be used (no camera, blocked,
 * unsupported). The server checks the photo again either way.
 */
export function CameraCapture({ onChange, disabled = false }: CameraCaptureProps) {
  const [state, setState] = useState<CameraState>(() =>
    cameraSupported() ? { kind: 'idle' } : { kind: 'error', error: 'unsupported' },
  )
  const [fileError, setFileError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }

  // Turn the camera off and free the preview when the component goes away.
  useEffect(
    () => () => {
      stopCamera()
      clearPreview()
    },
    [],
  )

  async function startCamera() {
    setFileError(null)
    setState({ kind: 'starting' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCamera()
        return
      }
      video.srcObject = stream
      await video.play()
      setState({ kind: 'live' })
    } catch (error: unknown) {
      stopCamera()
      setState({ kind: 'error', error: toCameraError(error) })
    }
  }

  function showPhoto(blob: Blob, fileName: string, source: CapturedPhoto['source'], fallback: CameraError | null = null) {
    clearPreview()
    const previewUrl = URL.createObjectURL(blob)
    previewUrlRef.current = previewUrl
    setState({ kind: 'captured', previewUrl, source, fallback })
    onChange({ blob, fileName, source })
  }

  function takePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!video || !canvas || !context || video.videoWidth === 0) {
      setState({ kind: 'error', error: 'failed' })
      return
    }
    // The preview is mirrored like a mirror; the saved photo is not.
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setState({ kind: 'error', error: 'failed' })
          return
        }
        stopCamera()
        showPhoto(blob, 'attendance.jpg', 'camera')
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }

  function retake() {
    const fallback = state.kind === 'captured' ? state.fallback : null
    clearPreview()
    onChange(null)
    // A camera photo: back to the camera. An upload: back to the upload choice and its reason.
    if (fallback) setState({ kind: 'error', error: fallback })
    else void startCamera()
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // picking the same file again still fires onChange
    if (!file) return
    if (!PHOTO_TYPES.some((type) => type === file.type)) {
      setFileError('Choose a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setFileError(`The photo is ${formatFileSize(file.size)}. The limit is ${formatFileSize(PHOTO_MAX_BYTES)}.`)
      return
    }
    setFileError(null)
    showPhoto(file, file.name, 'upload', state.kind === 'error' ? state.error : 'failed')
  }

  const live = state.kind === 'live'

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-muted">
        {/* Always rendered, so the ref exists when the stream starts; hidden until live. */}
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className={live ? 'size-full -scale-x-100 object-cover' : 'hidden'}
        />
        {state.kind === 'captured' && (
          <img src={state.previewUrl} alt="The photo you took" className="size-full object-cover" />
        )}
        {(state.kind === 'idle' || state.kind === 'starting') && (
          <p className="px-6 text-center text-sm text-ink-muted">
            {state.kind === 'starting' ? 'Starting the camera… allow access if your browser asks.' : 'Your photo is the proof that you are working from home.'}
          </p>
        )}
        {state.kind === 'error' && (
          <p role="alert" className="px-6 text-center text-sm text-ink-muted">
            {ERROR_MESSAGE[state.error]}
          </p>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-2">
        {(state.kind === 'idle' || state.kind === 'starting') && (
          <Button onClick={() => void startCamera()} loading={state.kind === 'starting'} disabled={disabled}>
            Turn on camera
          </Button>
        )}
        {live && (
          <Button onClick={takePhoto} disabled={disabled}>
            Take photo
          </Button>
        )}
        {state.kind === 'captured' && (
          <Button variant="secondary" onClick={retake} disabled={disabled}>
            {state.source === 'camera' ? 'Retake' : 'Choose another photo'}
          </Button>
        )}
        {state.kind === 'error' && RETRYABLE.has(state.error) && (
          <Button variant="secondary" onClick={() => void startCamera()} disabled={disabled}>
            Try the camera again
          </Button>
        )}
        {state.kind === 'error' && (
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface px-4.5 font-semibold text-ink hover:bg-surface-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-65 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
            Upload a photo
            <input type="file" accept={ACCEPT} className="sr-only" onChange={onFile} disabled={disabled} />
          </label>
        )}
      </div>
      {fileError && (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {fileError}
        </p>
      )}
    </div>
  )
}
