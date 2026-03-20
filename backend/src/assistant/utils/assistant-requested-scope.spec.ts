import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { resolveRequestedAssistantDataScope } from './assistant-requested-scope.util';

describe('resolveRequestedAssistantDataScope', () => {
  const full = 'admin';
  const emp = 'empleado';

  describe('FULL_ACCESS', () => {
    it.each([
      ['que ausencias tengo este mes', AssistantDataScope.OWN],
      ['mis ausencias este mes', AssistantDataScope.OWN],
      ['mi horario hoy', AssistantDataScope.OWN],
      ['mis nominas de febrero', AssistantDataScope.OWN],
      ['que ausencias hay este mes', AssistantDataScope.ALL],
      ['quien tiene vacaciones mañana', AssistantDataScope.ALL],
      ['lista de empleados sin cuadrante', AssistantDataScope.ALL],
    ])('%s → %s', (msg, scope) => {
      expect(resolveRequestedAssistantDataScope(msg, full)).toBe(scope);
    });
  });

  describe('EMPLEADO', () => {
    it.each([
      'que ausencias tengo este mes',
      'quien tiene vacaciones mañana',
      'que ausencias hay este mes',
      'mis nominas de febrero',
    ])('%s → mereu OWN', (msg) => {
      expect(resolveRequestedAssistantDataScope(msg, emp)).toBe(
        AssistantDataScope.OWN,
      );
    });
  });

  it('developer se tratează ca FULL_ACCESS', () => {
    expect(
      resolveRequestedAssistantDataScope(
        'mis solicitudes pendientes',
        'developer',
      ),
    ).toBe(AssistantDataScope.OWN);
  });
});
