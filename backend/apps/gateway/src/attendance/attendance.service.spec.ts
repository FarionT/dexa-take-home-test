import { HttpException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { ATTENDANCE_PATTERNS, EMPLOYEE_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type { AttendanceRecord, JwtPayload } from '@app/shared';
import { AttendanceService, DATE_RANGE_REVERSED, EMPLOYEE_INACTIVE } from './attendance.service.js';
import type { ValidatedPhoto } from './photo/photo-file.pipe.js';
import { PhotoStorageService } from './photo/photo-storage.service.js';

const USER: JwtPayload = { sub: 'u-1', employee_id: 'e-1', role: 'EMPLOYEE', must_change_password: false };
const PHOTO: ValidatedPhoto = { buffer: Buffer.from([0xff, 0xd8, 0xff]), mime: 'image/jpeg', size: 3 };
const SAVED_PATH = 'attendance/2026/11/abc.jpg';
const RECORD: AttendanceRecord = {
  id: 'a-1',
  employee_id: 'e-1',
  type: 'CHECK_IN',
  attendance_date: '2026-11-06',
  recorded_at: '2026-11-06T01:05:00.000Z',
  notes: null,
  photo: { mime: 'image/jpeg', size: 3 },
};

type Send = (pattern: string, payload: unknown) => Observable<unknown>;
const refused = (status_code: number, message: string) => throwError(() => ({ status_code, message }));

async function httpErrorOf(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) return { status: error.getStatus(), message: error.message };
    throw error;
  }
  throw new Error('expected an HttpException');
}

describe('AttendanceService (gateway)', () => {
  const attendanceSend = vi.fn<Send>();
  const employeeSend = vi.fn<Send>();
  const photos = { save: vi.fn(), remove: vi.fn(), open: vi.fn() };
  let service: AttendanceService;

  beforeEach(async () => {
    [attendanceSend, employeeSend, ...Object.values(photos)].forEach((fn) => fn.mockReset());
    employeeSend.mockReturnValue(of({ id: 'e-1', status: 'ACTIVE' }));
    photos.save.mockResolvedValue(SAVED_PATH);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: SERVICE_CLIENTS.attendance, useValue: { send: attendanceSend } },
        { provide: SERVICE_CLIENTS.employee, useValue: { send: employeeSend } },
        { provide: PhotoStorageService, useValue: photos },
      ],
    }).compile();
    service = module.get(AttendanceService);
  });

  describe('record', () => {
    it('saves the photo, then records it with the employee from the token', async () => {
      attendanceSend.mockReturnValue(of(RECORD));

      const view = await service.record('CHECK_IN', USER, PHOTO, { notes: 'From home' });

      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.FIND_ONE, { id: 'e-1' });
      expect(attendanceSend).toHaveBeenCalledWith(ATTENDANCE_PATTERNS.RECORD, {
        employee_id: 'e-1',
        type: 'CHECK_IN',
        photo_path: SAVED_PATH,
        photo_mime: 'image/jpeg',
        photo_size: 3,
        notes: 'From home',
      });
      expect(view.photo.url).toBe('/attendance/a-1/photo');
      expect(photos.remove).not.toHaveBeenCalled();
    });

    it('removes the saved photo when the attendance service refuses (already checked in)', async () => {
      attendanceSend.mockReturnValue(refused(409, 'You have already checked in today'));

      expect(await httpErrorOf(service.record('CHECK_IN', USER, PHOTO, {}))).toEqual({
        status: 409,
        message: 'You have already checked in today',
      });
      expect(photos.remove).toHaveBeenCalledWith(SAVED_PATH);
    });

    it('keeps the photo on 503: after a timeout the service may have stored the record', async () => {
      const down = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      attendanceSend.mockReturnValue(throwError(() => down));

      expect((await httpErrorOf(service.record('CHECK_IN', USER, PHOTO, {}))).status).toBe(503);
      expect(photos.remove).not.toHaveBeenCalled();
    });

    it('still returns the original error if removing the photo fails', async () => {
      attendanceSend.mockReturnValue(refused(400, 'You have not checked in today'));
      photos.remove.mockRejectedValue(new Error('EACCES'));

      expect((await httpErrorOf(service.record('CHECK_OUT', USER, PHOTO, {}))).status).toBe(400);
    });

    it.each([
      ['INACTIVE', of({ id: 'e-1', status: 'INACTIVE' })],
      ['deleted', refused(404, 'Employee not found')],
    ])('refuses a %s employee with 403 before saving anything', async (_label, reply) => {
      employeeSend.mockReturnValue(reply);

      expect(await httpErrorOf(service.record('CHECK_IN', USER, PHOTO, {}))).toEqual({ status: 403, message: EMPLOYEE_INACTIVE });
      expect(photos.save).not.toHaveBeenCalled();
      expect(attendanceSend).not.toHaveBeenCalled();
    });
  });

  describe('listMine', () => {
    it('lists only the caller and computes the pages', async () => {
      attendanceSend.mockReturnValue(of({ items: [{ employee_id: 'e-1', attendance_date: '2026-11-06', check_in: RECORD, check_out: null, work_minutes: null }], total: 21 }));

      const result = await service.listMine(USER, { page: 2, limit: 10, date_from: '2026-11-01' });

      expect(attendanceSend).toHaveBeenCalledWith(ATTENDANCE_PATTERNS.LIST_DAYS, {
        page: 2,
        limit: 10,
        employee_ids: ['e-1'],
        date_from: '2026-11-01',
        date_to: undefined,
      });
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, total_pages: 3 });
      expect(result.items[0].check_in?.photo.url).toBe('/attendance/a-1/photo');
    });

    it('rejects date_from after date_to', async () => {
      expect(await httpErrorOf(service.listMine(USER, { page: 1, limit: 10, date_from: '2026-11-30', date_to: '2026-11-01' }))).toEqual({
        status: 400,
        message: DATE_RANGE_REVERSED,
      });
      expect(attendanceSend).not.toHaveBeenCalled();
    });
  });

  describe('listAll (HR)', () => {
    // 2026-11-06 08:05 WIB
    const NOW = new Date('2026-11-06T01:05:00.000Z');
    const DAY = { employee_id: 'e-1', attendance_date: '2026-11-06', check_in: RECORD, check_out: null, work_minutes: null };
    const BUDI = { id: 'e-1', employee_code: 'EMP-0002', full_name: 'Budi', department: { id: 'd-1', name: 'Engineering' }, status: 'ACTIVE', is_deleted: false };
    const sentTo = (send: typeof attendanceSend, pattern: string) => send.mock.calls.find(([p]) => p === pattern)?.[1];

    it("shows today's days of everyone when no date is given, with names from one batch call", async () => {
      attendanceSend.mockReturnValue(of({ items: [DAY, { ...DAY, employee_id: 'e-gone' }], total: 2 }));
      employeeSend.mockReturnValue(of([BUDI]));

      const result = await service.listAll({ page: 1, limit: 10 }, NOW);

      expect(sentTo(attendanceSend, ATTENDANCE_PATTERNS.LIST_DAYS)).toEqual({
        page: 1,
        limit: 10,
        employee_ids: undefined, // no employee filter: everyone
        date_from: '2026-11-06',
        date_to: '2026-11-06',
      });
      expect(employeeSend).toHaveBeenCalledTimes(1);
      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.FIND_BY_IDS, { ids: ['e-1', 'e-gone'] });
      expect(result.items.map((day) => day.employee?.full_name ?? null)).toEqual(['Budi', null]);
      expect(result.items[0].check_in?.photo.url).toBe('/attendance/a-1/photo');
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 2, total_pages: 1, date_from: '2026-11-06', date_to: '2026-11-06' });
    });

    it('keeps an open-ended range when only one date is given', async () => {
      attendanceSend.mockReturnValue(of({ items: [], total: 0 }));

      const result = await service.listAll({ page: 1, limit: 10, date_from: '2026-11-01' }, NOW);

      expect(sentTo(attendanceSend, ATTENDANCE_PATTERNS.LIST_DAYS)).toMatchObject({ date_from: '2026-11-01', date_to: undefined });
      expect(result.meta).toMatchObject({ date_from: '2026-11-01', date_to: null });
      expect(employeeSend).not.toHaveBeenCalled(); // empty page: no name lookup
    });

    it('turns department and search into employee ids first', async () => {
      employeeSend.mockReturnValueOnce(of(['e-1', 'e-3'])).mockReturnValueOnce(of([BUDI]));
      attendanceSend.mockReturnValue(of({ items: [DAY], total: 1 }));

      await service.listAll({ page: 1, limit: 10, department_id: 'd-1', search: 'bud' }, NOW);

      expect(employeeSend).toHaveBeenNthCalledWith(1, EMPLOYEE_PATTERNS.FIND_IDS, { department_id: 'd-1', search: 'bud' });
      expect(sentTo(attendanceSend, ATTENDANCE_PATTERNS.LIST_DAYS)).toMatchObject({ employee_ids: ['e-1', 'e-3'] });
    });

    it('rejects a reversed range', async () => {
      expect((await httpErrorOf(service.listAll({ page: 1, limit: 10, date_from: '2026-11-07', date_to: '2026-11-01' }, NOW))).message).toBe(
        DATE_RANGE_REVERSED,
      );
    });
  });

  it('photo asks the attendance service with the viewer from the token', async () => {
    attendanceSend.mockReturnValue(of({ photo_path: SAVED_PATH, photo_mime: 'image/jpeg' }));
    photos.open.mockResolvedValue({ stream: { pipe: vi.fn() }, size: 3 });

    await service.photo('a-1', { ...USER, role: 'ADMIN' });

    expect(attendanceSend).toHaveBeenCalledWith(ATTENDANCE_PATTERNS.FIND_PHOTO, {
      id: 'a-1',
      viewer_employee_id: 'e-1',
      viewer_is_admin: true,
    });
    expect(photos.open).toHaveBeenCalledWith(SAVED_PATH);
  });
});
