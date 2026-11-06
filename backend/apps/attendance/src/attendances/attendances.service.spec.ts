import { RpcException } from '@nestjs/microservices';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { UniqueConstraintError } from 'sequelize';
import type { RecordAttendanceRequest } from '@app/shared';
import { Attendance } from './attendance.model.js';
import { ALREADY_CHECKED_IN, ALREADY_CHECKED_OUT, AttendancesService, NOT_CHECKED_IN, NOT_FOUND } from './attendances.service.js';

// 2026-11-06 08:05 in Jakarta (UTC+7).
const NOW = new Date('2026-11-06T01:05:00.000Z');

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    employee_id: 'e-1',
    type: 'CHECK_IN',
    attendance_date: '2026-11-06',
    recorded_at: NOW,
    photo_path: 'attendance/2026/11/x.jpg',
    photo_mime: 'image/jpeg',
    photo_size: 1234,
    notes: null,
    ...overrides,
  };
}

const REQUEST: RecordAttendanceRequest = {
  employee_id: 'e-1',
  type: 'CHECK_IN',
  photo_path: 'attendance/2026/11/x.jpg',
  photo_mime: 'image/jpeg',
  photo_size: 1234,
  notes: 'Working from home',
};

async function rpcErrorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof RpcException) return error.getError();
    throw error;
  }
  throw new Error('expected an RpcException');
}

describe('AttendancesService', () => {
  const attendances = { findAll: vi.fn(), create: vi.fn(), count: vi.fn(), findByPk: vi.fn() };
  let service: AttendancesService;

  beforeEach(async () => {
    Object.values(attendances).forEach((fn) => fn.mockReset());
    attendances.create.mockImplementation((values: Record<string, unknown>) => Promise.resolve(fakeRow({ id: 'a-new', ...values })));
    const module = await Test.createTestingModule({
      providers: [AttendancesService, { provide: getModelToken(Attendance), useValue: attendances }],
    }).compile();
    service = module.get(AttendancesService);
  });

  describe('record', () => {
    it('checks in with the server time and the Jakarta working day', async () => {
      attendances.findAll.mockResolvedValue([]);

      const record = await service.record(REQUEST, NOW);

      expect(attendances.findAll).toHaveBeenCalledWith({ where: { employee_id: 'e-1', attendance_date: '2026-11-06' } });
      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'e-1', type: 'CHECK_IN', attendance_date: '2026-11-06', recorded_at: NOW }),
      );
      expect(record).toEqual({
        id: 'a-new',
        employee_id: 'e-1',
        type: 'CHECK_IN',
        attendance_date: '2026-11-06',
        recorded_at: NOW.toISOString(),
        notes: 'Working from home',
        photo: { mime: 'image/jpeg', size: 1234 },
      });
      expect(record).not.toHaveProperty('photo_path'); // the file location stays internal
    });

    it('counts 23:30 UTC as the next day in Jakarta', async () => {
      attendances.findAll.mockResolvedValue([]);
      await service.record(REQUEST, new Date('2026-11-06T17:30:00.000Z')); // 00:30 WIB on 7 Nov
      expect(attendances.create).toHaveBeenCalledWith(expect.objectContaining({ attendance_date: '2026-11-07' }));
    });

    it('refuses a second check-in on the same day with 409', async () => {
      attendances.findAll.mockResolvedValue([fakeRow()]);
      expect(await rpcErrorOf(service.record(REQUEST, NOW))).toEqual({ status_code: 409, message: ALREADY_CHECKED_IN });
      expect(attendances.create).not.toHaveBeenCalled();
    });

    it('refuses a check-out without a check-in that day with 400', async () => {
      attendances.findAll.mockResolvedValue([]);
      expect(await rpcErrorOf(service.record({ ...REQUEST, type: 'CHECK_OUT' }, NOW))).toEqual({
        status_code: 400,
        message: NOT_CHECKED_IN,
      });
    });

    it('refuses a second check-out with 409', async () => {
      attendances.findAll.mockResolvedValue([fakeRow(), fakeRow({ id: 'a-2', type: 'CHECK_OUT' })]);
      expect(await rpcErrorOf(service.record({ ...REQUEST, type: 'CHECK_OUT' }, NOW))).toEqual({
        status_code: 409,
        message: ALREADY_CHECKED_OUT,
      });
    });

    it('checks out after a check-in', async () => {
      attendances.findAll.mockResolvedValue([fakeRow()]);
      const record = await service.record({ ...REQUEST, type: 'CHECK_OUT' }, NOW);
      expect(record.type).toBe('CHECK_OUT');
    });

    it('turns a duplicate from a simultaneous request (unique key) into 409', async () => {
      attendances.findAll.mockResolvedValue([]);
      attendances.create.mockRejectedValue(new UniqueConstraintError({}));
      expect(await rpcErrorOf(service.record(REQUEST, NOW))).toEqual({ status_code: 409, message: ALREADY_CHECKED_IN });
    });
  });

  describe('today', () => {
    it('returns nulls before check-in', async () => {
      attendances.findAll.mockResolvedValue([]);
      expect(await service.today({ employee_id: 'e-1' }, NOW)).toEqual({
        employee_id: 'e-1',
        attendance_date: '2026-11-06',
        check_in: null,
        check_out: null,
        work_minutes: null,
      });
    });

    it('computes whole work minutes once both exist', async () => {
      attendances.findAll.mockResolvedValue([
        fakeRow(),
        fakeRow({ id: 'a-2', type: 'CHECK_OUT', recorded_at: new Date('2026-11-06T10:35:59.000Z') }),
      ]);
      const day = await service.today({ employee_id: 'e-1' }, NOW);
      expect(day.check_in?.id).toBe('a-1');
      expect(day.check_out?.id).toBe('a-2');
      expect(day.work_minutes).toBe(9 * 60 + 30);
    });
  });

  describe('listDays', () => {
    it('paginates days and fills each with its check-in and check-out', async () => {
      attendances.findAll
        .mockResolvedValueOnce([
          { employee_id: 'e-1', attendance_date: '2026-11-06' },
          { employee_id: 'e-1', attendance_date: '2026-11-05' },
        ])
        .mockResolvedValueOnce([
          fakeRow(),
          fakeRow({ id: 'a-0', attendance_date: '2026-11-05' }),
          fakeRow({ id: 'a-00', type: 'CHECK_OUT', attendance_date: '2026-11-05' }),
        ]);
      attendances.count.mockResolvedValue([{}, {}, {}]);

      const result = await service.listDays({ page: 2, limit: 2, employee_ids: ['e-1'], date_from: '2026-11-01' });

      expect(attendances.findAll).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ group: ['employee_id', 'attendance_date'], limit: 2, offset: 2 }),
      );
      expect(result.total).toBe(3);
      expect(result.items.map((day) => [day.attendance_date, day.check_in?.id, day.check_out?.id ?? null])).toEqual([
        ['2026-11-06', 'a-1', null],
        ['2026-11-05', 'a-0', 'a-00'],
      ]);
    });

    it('returns nothing for an empty employee filter without querying', async () => {
      expect(await service.listDays({ page: 1, limit: 10, employee_ids: [] })).toEqual({ items: [], total: 0 });
      expect(attendances.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findPhoto', () => {
    it('gives the owner the photo location', async () => {
      attendances.findByPk.mockResolvedValue(fakeRow());
      expect(await service.findPhoto({ id: 'a-1', viewer_employee_id: 'e-1', viewer_is_admin: false })).toEqual({
        photo_path: 'attendance/2026/11/x.jpg',
        photo_mime: 'image/jpeg',
      });
    });

    it('gives an ADMIN anyone’s photo', async () => {
      attendances.findByPk.mockResolvedValue(fakeRow());
      await expect(service.findPhoto({ id: 'a-1', viewer_employee_id: 'e-hr', viewer_is_admin: true })).resolves.toBeDefined();
    });

    it('answers another employee with the same 404 as an unknown id', async () => {
      attendances.findByPk.mockResolvedValue(fakeRow());
      const notOwner = await rpcErrorOf(service.findPhoto({ id: 'a-1', viewer_employee_id: 'e-2', viewer_is_admin: false }));
      attendances.findByPk.mockResolvedValue(null);
      const unknown = await rpcErrorOf(service.findPhoto({ id: 'a-x', viewer_employee_id: 'e-2', viewer_is_admin: false }));
      expect(notOwner).toEqual({ status_code: 404, message: NOT_FOUND });
      expect(unknown).toEqual(notOwner);
    });
  });
});
