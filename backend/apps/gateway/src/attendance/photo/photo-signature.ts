import type { AttendancePhotoMime } from '@app/shared';

/**
 * Detects the image type from the file's first bytes ("magic numbers"). The
 * Content-Type and file name sent by the client can say anything, so they are
 * never trusted.
 */
export function detectPhotoMime(bytes: Uint8Array): AttendancePhotoMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" <4-byte size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) {
    return 'image/webp';
  }
  return null;
}

export const PHOTO_EXTENSIONS: Record<AttendancePhotoMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}
