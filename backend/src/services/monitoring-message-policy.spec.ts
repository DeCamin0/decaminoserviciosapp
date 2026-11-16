import { ForbiddenException } from '@nestjs/common';
import {
  assertHealthTelegramTest,
  bannerConfirmationRecipient,
  escapeMonitoringHtml,
  resolveTelegramBot,
} from './monitoring-message-policy';

const employee = {
  userId: 'E10',
  email: 'ana@example.com',
  grupo: 'Operario',
  role: 'EMPLEADOS',
  isManager: false,
};

const manager = {
  userId: 'M1',
  email: 'jefe@example.com',
  grupo: 'Manager',
  role: 'MANAGER',
  isManager: true,
};

describe('monitoring message policy', () => {
  it('angajatul raportează doar pe botul general, chiar dacă cere gestoría', () => {
    expect(resolveTelegramBot(employee, 'gestoria')).toBe('general');
    expect(resolveTelegramBot(employee, undefined)).toBe('general');
  });

  it('managerul și administratorul pot alege botul', () => {
    expect(resolveTelegramBot(manager, 'general')).toBe('general');
    expect(resolveTelegramBot(manager, 'gestoria')).toBe('gestoria');
    expect(
      resolveTelegramBot(
        { userId: 'A1', grupo: 'Admin', role: 'ADMIN', isManager: true },
        undefined,
      ),
    ).toBe('gestoria');
  });

  it('emailul de confirmare pleacă doar la adresa din sesiune', () => {
    expect(bannerConfirmationRecipient(employee, ' Ana@example.com ')).toBe(
      'Ana@example.com',
    );
    expect(() =>
      bannerConfirmationRecipient(employee, 'otro@example.com'),
    ).toThrow(ForbiddenException);
    expect(() => bannerConfirmationRecipient(employee, '')).toThrow(
      ForbiddenException,
    );
  });

  it('numele din email nu poate injecta HTML', () => {
    expect(escapeMonitoringHtml('<b>Ana</b> & "x"')).toBe(
      '&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;x&quot;',
    );
  });

  it('mesajul de test Telegram este doar pentru personalul autorizat', () => {
    expect(() => assertHealthTelegramTest(employee)).toThrow(
      ForbiddenException,
    );
    expect(() => assertHealthTelegramTest(manager)).not.toThrow();
    expect(() =>
      assertHealthTelegramTest({
        userId: 'S1',
        grupo: 'Supervisor',
        role: 'EMPLEADOS',
        isManager: false,
      }),
    ).not.toThrow();
  });
});
