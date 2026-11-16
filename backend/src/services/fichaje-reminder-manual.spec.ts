import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { FichajeReminderCronService } from './fichaje-reminder-cron.service';
import { FichajeReminderService } from './fichaje-reminder.service';
import { emptyEmpleadoModuleFlags } from './empleados-operation-access';
import {
  assertManualReminderPermission,
  ManualReminderLimiter,
  reminderAudienceCodigos,
  resolveManualReminderMode,
  wantsRealReminderSend,
} from './fichaje-reminder-manual';

const none = emptyEmpleadoModuleFlags();
const ficharAdmin = { ...none, ficharAdmin: true };
const allDenied = {
  empleados: false,
  ficharAdmin: false,
  ficharEmpleados: false,
  aprobaciones: false,
  admin: false,
};

describe('reminder manual: permisiune, mod și scope', () => {
  it('Admin și Developer trec cu toate bifele false; restul doar cu fichar-admin', () => {
    expect(() =>
      assertManualReminderPermission(
        { userId: 'A1', grupo: 'Admin', role: 'ADMIN' },
        allDenied,
      ),
    ).not.toThrow();
    expect(() =>
      assertManualReminderPermission(
        { userId: 'D1', grupo: 'Altul', role: 'DEVELOPER' },
        allDenied,
      ),
    ).not.toThrow();
    expect(() =>
      assertManualReminderPermission(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        allDenied,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertManualReminderPermission(
        { userId: 'E1', grupo: 'Operario', role: 'EMPLEADOS' },
        ficharAdmin,
      ),
    ).not.toThrow();
    expect(() =>
      assertManualReminderPermission(
        { userId: 'E1', grupo: 'Operario', role: 'EMPLEADOS' },
        none,
      ),
    ).toThrow(ForbiddenException);
  });

  it('dryRun=false cere cronul pornit și nu trece peste dry-run-ul din mediu', () => {
    expect(wantsRealReminderSend(undefined)).toBe(false);
    expect(wantsRealReminderSend('true')).toBe(false);
    expect(wantsRealReminderSend('false')).toBe(true);
    expect(
      resolveManualReminderMode({
        requestedReal: false,
        enabled: false,
        envForcesDryRun: true,
      }),
    ).toEqual({ dryRun: true });
    expect(
      resolveManualReminderMode({
        requestedReal: true,
        enabled: true,
        envForcesDryRun: false,
      }),
    ).toEqual({ dryRun: false });
    expect(() =>
      resolveManualReminderMode({
        requestedReal: true,
        enabled: false,
        envForcesDryRun: false,
      }),
    ).toThrow(ForbiddenException);
    expect(() =>
      resolveManualReminderMode({
        requestedReal: true,
        enabled: true,
        envForcesDryRun: true,
      }),
    ).toThrow(ForbiddenException);
  });

  it('scope-ul gol de rânduri lasă firma, iar lista goală nu o deschide', () => {
    expect(reminderAudienceCodigos(true, true, ['E1'])).toBeNull();
    expect(reminderAudienceCodigos(false, false, ['E1'])).toBeNull();
    expect(reminderAudienceCodigos(false, true, ['E1', 'E2'])).toEqual([
      'E1',
      'E2',
    ]);
    expect(reminderAudienceCodigos(false, true, null)).toEqual([]);
    expect(reminderAudienceCodigos(false, true, [])).toEqual([]);
  });

  it('același utilizator nu pornește două rulări, iar trimiterea reală are pauză', () => {
    const limiter = new ManualReminderLimiter();
    limiter.start('U1', false, 0, 60_000);
    expect(() => limiter.start('U1', true, 10, 60_000)).toThrow(HttpException);
    limiter.finish('U1', false, 10);
    limiter.start('U1', true, 20, 60_000);
    limiter.finish('U1', true, 20);
    expect(() => limiter.start('U1', true, 30_000, 60_000)).toThrow(
      HttpException,
    );
    limiter.start('U1', false, 30_000, 60_000);
    limiter.finish('U1', false, 30_000);
    expect(() => limiter.start('U2', true, 30_000, 60_000)).not.toThrow();
  });
});

describe('reminder: cron independent și coduri nenumerice', () => {
  const cronSource = readFileSync(
    join(__dirname, 'fichaje-reminder-cron.service.ts'),
    'utf8',
  );

  it('cronul rămâne pe toată firma și nu primește limita manuală', () => {
    const start = cronSource.indexOf('async handleCron');
    const call = cronSource.indexOf('this.runReminders();', start);
    const body = cronSource.slice(start, call + 'this.runReminders();'.length);
    expect(body).toContain('if (!this.isEnabled())');
    expect(body).toContain('await this.runReminders()');
    expect(body).not.toContain('allowedCodigos');
    expect(body).not.toContain('manual');
  });

  it('cronul oprit nu scanează, iar suprapunerea manuală nu pornește a doua trimitere', async () => {
    const processReminders = jest.fn().mockResolvedValue({
      scanned: 1,
      sent: 0,
      dryRun: true,
      candidates: [],
      skipped: [],
    });
    const disabled = new FichajeReminderCronService(
      { get: () => undefined } as any,
      { processReminders } as any,
    );
    await disabled.handleCron();
    expect(processReminders).not.toHaveBeenCalled();

    let release: (value: unknown) => void = () => undefined;
    processReminders.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const enabled = new FichajeReminderCronService(
      {
        get: (key: string) =>
          key === 'FICHAJE_REMINDER_ENABLED' ? 'true' : undefined,
      } as any,
      { processReminders } as any,
    );
    const first = enabled.runReminders({
      manual: true,
      dryRun: true,
      allowedCodigos: ['E10'],
    });
    await Promise.resolve();
    await expect(
      enabled.runReminders({ manual: true, dryRun: false }),
    ).rejects.toBeInstanceOf(HttpException);
    await enabled.handleCron();
    expect(processReminders).toHaveBeenCalledTimes(1);
    expect(processReminders).toHaveBeenCalledWith({
      dryRun: true,
      allowedCodigos: ['E10'],
    });
    release({ scanned: 1, sent: 0, dryRun: true, candidates: [], skipped: [] });
    await first;
  });

  it('codul nenumeric nu devine un id care se poate ciocni', () => {
    const service = new FichajeReminderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service.codigoToEmpleadoId('E10')).toBeNull();
    expect(service.codigoToEmpleadoId('ABC')).toBeNull();
    expect(service.codigoToEmpleadoId('42')).toBe(42);
    expect(service.codigoToEmpleadoId('00042')).toBe(42);
    expect(service.codigoToEmpleadoId('2147483648')).toBeNull();
    expect(service.codigoToEmpleadoId('')).toBeNull();
  });
});

describe('processReminders izolat, fără notificări reale', () => {
  const madrid = {
    dateStr: '2026-11-09',
    year: 2026,
    month: 11,
    day: 9,
    hour: 9,
    minute: 0,
    second: 0,
    minutesOfDay: 540,
    lunaYyyyMm: '2026-11',
    weekdayJs: 1,
  };

  function employee(codigo: string) {
    return {
      codigo,
      nombre: `Nombre ${codigo}`,
      email: `${codigo}@example.com`,
      centro: 'Norte',
      grupo: 'Operario',
      trabajaFestivos: 'NO',
    };
  }

  function makeService(employees: Array<ReturnType<typeof employee>>) {
    const notifications: Array<{
      codigo: string;
      data: string;
      elapsed_min: number;
    }> = [];
    const inserts: string[] = [];
    const prisma = {
      $queryRawUnsafe: jest.fn(async (sql: string) => {
        if (sql.includes("<> 'EXTRABAJADOR'")) return employees;
        if (sql.includes("= 'EXTRABAJADOR'")) return [];
        if (sql.includes('FROM notifications')) return notifications;
        return [];
      }),
      $executeRawUnsafe: jest.fn(async (sql: string) => {
        inserts.push(sql);
        return 1;
      }),
    };
    const notifyUser = jest.fn(
      async (_sender: string, codigo: string, body: any) => {
        notifications.push({
          codigo,
          data: JSON.stringify(body.data),
          elapsed_min: 0,
        });
      },
    );
    const config = {
      get: (key: string) => {
        if (key === 'FICHAJE_REMINDER_DRY_RUN') return 'false';
        if (key === 'FICHAJE_REMINDER_RETRY_MINUTES') return '30';
        if (key === 'FICHAJE_REMINDER_WINDOW_MINUTES') return '15';
        return undefined;
      },
    };
    const resolver = {
      getMadridNow: () => madrid,
      resolveForEmployees: jest.fn(async (rows: typeof employees) =>
        rows.map((row) => ({
          ...row,
          source: 'horario',
          slotRaw: '08:00-16:00',
          intervals: [{ horaIn: '08:00', horaOut: '16:00' }],
          isOff: false,
          entryMarginMinutes: 15,
          exitMarginMinutes: 15,
        })),
      ),
      isReminderDueForInterval: () => true,
    };
    const service = new FichajeReminderService(
      prisma as any,
      config as any,
      { notifyUser } as any,
      resolver as any,
      { hasSchema: async () => false } as any,
    );
    return { service, notifyUser, inserts, notifications };
  }

  it('previzualizarea cu scope nu scrie și nu notifică în afara listei', async () => {
    const { service, notifyUser, inserts } = makeService([
      employee('E10'),
      employee('42'),
    ]);
    const preview = await service.processReminders({
      dryRun: true,
      allowedCodigos: ['E10'],
    });
    expect(preview.dryRun).toBe(true);
    expect(preview.candidates.map((row) => row.codigo)).toEqual(['E10']);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);

    const empty = await service.processReminders({
      dryRun: true,
      allowedCodigos: [],
    });
    expect(empty.scanned).toBe(0);
    expect(empty.candidates).toEqual([]);
  });

  it('trimiterea reală anunță o singură dată, inclusiv la apeluri simultane și la cod nenumeric', async () => {
    const { service, notifyUser, inserts } = makeService([employee('E10')]);
    const [first, second] = await Promise.all([
      service.processReminders({ dryRun: false }),
      service.processReminders({ dryRun: false }),
    ]);
    const sentRuns = [first, second].filter((row) => row.sent === 1);
    expect(sentRuns).toHaveLength(1);
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser.mock.calls[0][1]).toBe('E10');
    expect(inserts.some((sql) => sql.includes('NotificariFichaje'))).toBe(
      false,
    );

    const again = await service.processReminders({ dryRun: false });
    expect(again.sent).toBe(0);
    expect(again.skippedDedup).toBe(1);
    expect(notifyUser).toHaveBeenCalledTimes(1);
  });

  it('codul numeric se înregistrează, iar rândul din notifications blochează retrimiterea', async () => {
    const firstBox = makeService([employee('42')]);
    const sent = await firstBox.service.processReminders({ dryRun: false });
    expect(sent.sent).toBe(1);
    expect(
      firstBox.inserts.some((sql) => sql.includes('NotificariFichaje')),
    ).toBe(true);

    const secondBox = makeService([employee('42')]);
    secondBox.notifications.push(...firstBox.notifications);
    const repeat = await secondBox.service.processReminders({ dryRun: false });
    expect(repeat.sent).toBe(0);
    expect(repeat.skippedDedup).toBe(1);
    expect(secondBox.notifyUser).not.toHaveBeenCalled();
  });
});
