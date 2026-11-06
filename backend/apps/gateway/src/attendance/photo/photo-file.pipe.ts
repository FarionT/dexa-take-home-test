import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { AttendancePhotoMime } from '@app/shared';
import { detectPhotoMime } from './photo-signature.js';

export const PHOTO_FIELD = 'photo';
export const PHOTO_REQUIRED = 'photo is required';
export const PHOTO_WRONG_TYPE = 'photo must be a JPEG, PNG or WebP image';

/** An uploaded photo after checking: `mime` comes from the file's bytes. */
export interface ValidatedPhoto {
  buffer: Buffer;
  mime: AttendancePhotoMime;
  size: number;
}

/** The parts of multer's in-memory file this app reads. */
interface MemoryFile {
  buffer: Buffer;
  size: number;
}

function isMemoryFile(value: unknown): value is MemoryFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buffer' in value &&
    Buffer.isBuffer(value.buffer) &&
    'size' in value &&
    typeof value.size === 'number'
  );
}

/**
 * For `@UploadedFile(PhotoFilePipe)`: the photo must be present, non-empty and
 * really a JPEG / PNG / WebP. The size limit is enforced earlier by multer (413).
 */
@Injectable()
export class PhotoFilePipe implements PipeTransform<unknown, ValidatedPhoto> {
  transform(value: unknown): ValidatedPhoto {
    if (!isMemoryFile(value) || value.size === 0) throw new BadRequestException(PHOTO_REQUIRED);
    const mime = detectPhotoMime(value.buffer);
    if (!mime) throw new BadRequestException(PHOTO_WRONG_TYPE);
    return { buffer: value.buffer, mime, size: value.size };
  }
}
