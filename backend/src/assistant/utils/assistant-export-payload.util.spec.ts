import { deepCloneForAssistantExport } from './assistant-export-payload.util';

describe('deepCloneForAssistantExport', () => {
  it('clona array profundo (export no muta original)', () => {
    const orig = [{ a: 1 }, { b: 2 }];
    const c = deepCloneForAssistantExport(orig) as typeof orig;
    expect(c).toEqual(orig);
    c[0].a = 99;
    expect(orig[0].a).toBe(1);
  });

  it('clona objeto SOLICITUDES combo', () => {
    const orig = {
      solicitudes: [{ id: 1 }],
      ausencias_calendario: [{ TIPO: 'X' }],
    };
    const c = deepCloneForAssistantExport(orig) as typeof orig;
    expect(c).toEqual(orig);
    c.solicitudes.push({ id: 2 });
    expect(orig.solicitudes.length).toBe(1);
  });
});
