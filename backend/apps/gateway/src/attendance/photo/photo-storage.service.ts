import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PHOTO_EXTENSIONS } from './photo-signature.js';
import type { ValidatedPhoto } from './photo-file.pipe.js';

export const DEFAULT_UPLOAD_DIR = './uploads';
export const PHOTO_NOT_FOUND = 'Photo not found';

/**
 * Attendance photos on disk under UPLOAD_DIR. The database stores only the
 * relative path. File names are new UUIDs, never the uploaded name, so a
 * client can't choose where a file goes or overwrite another one.
 */
@Injectable()
export class PhotoStorageService {
  private readonly logger = new Logger(PhotoStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('UPLOAD_DIR') ?? DEFAULT_UPLOAD_DIR);
  }

  /** Writes the photo and returns its path relative to UPLOAD_DIR, e.g. `attendance/2026/11/<uuid>.jpg`. */
  async save(photo: ValidatedPhoto, now: Date = new Date()): Promise<string> {
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const relative = path.posix.join('attendance', year, month, `${randomUUID()}.${PHOTO_EXTENSIONS[photo.mime]}`);
    const full = this.resolve(relative);
    await mkdir(path.dirname(full), { recursive: true });
    // 'wx' fails instead of overwriting, in case of a (practically impossible) UUID clash.
    await writeFile(full, photo.buffer, { flag: 'wx' });
    return relative;
  }

  /** Removes a photo that was saved but never recorded (the check-in was refused). */
  async remove(relative: string): Promise<void> {
    await rm(this.resolve(relative), { force: true });
  }

  /** Opens a stored photo for streaming; 404 if the file is missing on disk. */
  async open(relative: string): Promise<{ stream: ReadStream; size: number }> {
    const full = this.resolve(relative);
    try {
      const info = await stat(full);
      return { stream: createReadStream(full), size: info.size };
    } catch (error: unknown) {
      this.logger.error(`Attendance photo missing on disk: ${relative}`, error instanceof Error ? error.message : String(error));
      throw new NotFoundException(PHOTO_NOT_FOUND);
    }
  }

  /** Absolute path inside UPLOAD_DIR. Refuses anything that would point outside it. */
  private resolve(relative: string): string {
    const full = path.resolve(this.root, relative);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Photo path outside UPLOAD_DIR: ${relative}`);
    return full;
  }
}
