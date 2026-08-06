import { FichajeScheduleResolverService } from './fichaje-schedule-resolver.service';

describe('FichajeScheduleResolverService', () => {
  const resolver = new FichajeScheduleResolverService({} as any);

  describe('parseSlotRaw', () => {
    it('marks LIBRE as off', () => {
      expect(resolver.parseSlotRaw('LIBRE')).toEqual({
        isOff: true,
        intervals: [],
      });
    });

    it('parses T1 label + range', () => {
      expect(resolver.parseSlotRaw('T1 09:00-17:00')).toEqual({
        isOff: false,
        intervals: [{ horaIn: '09:00', horaOut: '17:00' }],
      });
    });

    it('parses split shared day', () => {
      expect(resolver.parseSlotRaw('09:00-15:00 / 16:00-20:00')).toEqual({
        isOff: false,
        intervals: [
          { horaIn: '09:00', horaOut: '15:00' },
          { horaIn: '16:00', horaOut: '20:00' },
        ],
      });
    });

    it('returns no intervals for hours-only encoding', () => {
      expect(resolver.parseSlotRaw('8h')).toEqual({
        isOff: false,
        intervals: [],
      });
      expect(resolver.parseSlotRaw('24h (3×8h)').intervals).toEqual([]);
    });
  });

  describe('expectedTipoForInterval', () => {
    it('same-day: Entrada before out', () => {
      expect(
        resolver.expectedTipoForInterval(
          { horaIn: '09:00', horaOut: '17:00' },
          9 * 60 + 15,
        ),
      ).toBe('Entrada');
      expect(
        resolver.expectedTipoForInterval(
          { horaIn: '09:00', horaOut: '17:00' },
          17 * 60 + 10,
        ),
      ).toBe('Salida');
    });
  });

  describe('isWithinWindow', () => {
    it('accepts within margin', () => {
      expect(resolver.isWithinWindow(9 * 60 + 10, 9 * 60, 15)).toBe(true);
      expect(resolver.isWithinWindow(9 * 60 + 20, 9 * 60, 15)).toBe(false);
    });
  });

  describe('isReminderDue', () => {
    it('is due from target-margin including late', () => {
      // 09:00 target, 15 min margin → from 08:45
      expect(resolver.isReminderDue(8 * 60 + 44, 9 * 60, 15)).toBe(false);
      expect(resolver.isReminderDue(8 * 60 + 45, 9 * 60, 15)).toBe(true);
      expect(resolver.isReminderDue(12 * 60, 9 * 60, 15)).toBe(true);
    });
  });

  describe('isReminderDueForInterval overnight 19:30-07:30', () => {
    const night = { horaIn: '19:30', horaOut: '07:30' };

    it('Entrada due from 19:15, not in the morning', () => {
      expect(
        resolver.isReminderDueForInterval(7 * 60, night, 'Entrada', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(19 * 60 + 14, night, 'Entrada', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(19 * 60 + 15, night, 'Entrada', 15),
      ).toBe(true);
      expect(
        resolver.isReminderDueForInterval(19 * 60 + 55, night, 'Entrada', 15),
      ).toBe(true);
    });

    it('Salida NOT due in the evening after Entrada — only from 07:15 morning', () => {
      // Bug case: 19:55 after Entrada must NOT request Salida yet
      expect(
        resolver.isReminderDueForInterval(19 * 60 + 55, night, 'Salida', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(23 * 60, night, 'Salida', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(0, night, 'Salida', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(7 * 60 + 14, night, 'Salida', 15),
      ).toBe(false);
      expect(
        resolver.isReminderDueForInterval(7 * 60 + 15, night, 'Salida', 15),
      ).toBe(true);
      expect(
        resolver.isReminderDueForInterval(10 * 60, night, 'Salida', 15),
      ).toBe(true);
    });
  });
});
