import {
  IntentClassifierService,
  IntentType,
  type IntentContextSnapshot,
} from './intent-classifier.service';

describe('IntentClassifierService (natural language RO/ES)', () => {
  let svc: IntentClassifierService;

  beforeEach(() => {
    svc = new IntentClassifierService();
  });

  it('cine are vacanta in martie → VACACIONES + mes marzo', async () => {
    const r = await svc.classifyIntent('cine are vacanta in martie');
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.confianza).toBeGreaterThanOrEqual(0.3);
    expect(r.entidades?.mes).toBe('marzo');
  });

  it('dar in aprilie? + context VACACIONES → merge abril', async () => {
    const first = await svc.classifyIntent('cine are vacanta in martie');
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('dar in aprilie?');
    const r = svc.applyContextualFollowUp('dar in aprilie?', raw, ctx);
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.entidades?.mes).toBe('abril');
  });

  it('ce registre am azi → FICHAJES + fecha', async () => {
    const r = await svc.classifyIntent('ce registre am azi');
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pontajele de azi → FICHAJES + fecha', async () => {
    const r = await svc.classifyIntent('pontajele de azi');
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.fecha).toBeTruthy();
  });

  it('angajatii mei → EMPLEADOS', async () => {
    const r = await svc.classifyIntent('angajatii mei');
    expect(r.intent).toBe(IntentType.EMPLEADOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.3);
  });

  it('quién tiene vacaciones en abril → VACACIONES + abril', async () => {
    const r = await svc.classifyIntent('quién tiene vacaciones en abril');
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.entidades?.mes).toBe('abril');
  });

  it('mis empleados → EMPLEADOS', async () => {
    const r = await svc.classifyIntent('mis empleados');
    expect(r.intent).toBe(IntentType.EMPLEADOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.3);
  });

  it('Mi contrato → EMPLEADOS (datos propios, no DESCONOCIDO)', async () => {
    const r = await svc.classifyIntent('Mi contrato');
    expect(r.intent).toBe(IntentType.EMPLEADOS);
  });

  it('vacaciones en mayo → VACACIONES + mayo', async () => {
    const r = await svc.classifyIntent('vacaciones en mayo');
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.entidades?.mes).toBe('mayo');
  });

  it('y en junio? + context VACACIONES → junio', async () => {
    const first = await svc.classifyIntent('vacaciones en mayo');
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('y en junio?');
    const r = svc.applyContextualFollowUp('y en junio?', raw, ctx);
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.entidades?.mes).toBe('junio');
  });

  it('registros de hoy → FICHAJES + fecha', async () => {
    const r = await svc.classifyIntent('registros de hoy');
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('¿Cómo registro la jornada? → PROCEDIMIENTOS (cómo fichar, no consulta SQL)', async () => {
    const r = await svc.classifyIntent('¿Cómo registro la jornada?');
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
  });

  it('dirección + no me deja → PROCEDIMIENTOS (ETAPA 1 app-help)', async () => {
    const r = await svc.classifyIntent(
      'Quiero poner la direccion de mi casa y no me deja',
    );
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
  });

  it('da nu mi poti da tu o lista ? + context VACACIONES → păstrează marzo (follow-up listă)', async () => {
    const first = await svc.classifyIntent('cine are vacanta in martie');
    expect(first.intent).toBe(IntentType.VACACIONES);
    expect(first.entidades?.mes).toBe('marzo');

    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('da nu mi poti da tu o lista ?');
    expect(raw.intent).toBe(IntentType.DESCONOCIDO);

    const r = svc.applyContextualFollowUp(
      'da nu mi poti da tu o lista ?',
      raw,
      ctx,
    );
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.confianza).toBeGreaterThanOrEqual(0.78);
    expect(r.entidades?.mes).toBe('marzo');
  });

  it('lista de empleados + context VACACIONES → nu forțează VACACIONES (subiect nou)', async () => {
    const first = await svc.classifyIntent('cine are vacanta in martie');
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('lista de empleados');
    expect(raw.intent).toBe(IntentType.EMPLEADOS);

    const r = svc.applyContextualFollowUp('lista de empleados', raw, ctx);
    expect(r.intent).toBe(IntentType.EMPLEADOS);
  });

  it('me puedes dar más detalles + context FICHAJES → păstrează intent', async () => {
    const first = await svc.classifyIntent('ce registre am azi');
    expect(first.intent).toBe(IntentType.FICHAJES);
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('me puedes dar más detalles');
    const r = svc.applyContextualFollowUp(
      'me puedes dar más detalles',
      raw,
      ctx,
    );
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.fecha).toBe(first.entidades?.fecha);
  });

  it('ce absente am anu asta → SOLICITUDES + year (fără mes forțat)', async () => {
    const y = String(new Date().getFullYear());
    const r = await svc.classifyIntent('ce absente am anu asta');
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.year).toBe(y);
    expect(r.entidades?.mes).toBeUndefined();
  });

  it('ce registre de fichajes am luna asta → FICHAJES + completo lună curentă', async () => {
    const r = await svc.classifyIntent('ce registre de fichajes am luna asta');
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.mes).toMatch(/^completo_/);
  });

  it('este mes + context FICHAJES → păstrează intent și setează lună curentă', async () => {
    const first = await svc.classifyIntent('ce registre am azi');
    expect(first.intent).toBe(IntentType.FICHAJES);
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('este mes');
    const r = svc.applyContextualFollowUp('este mes', raw, ctx);
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.mes).toMatch(/^completo_/);
  });

  it('ausencias este año → SOLICITUDES + year curent (fără mes)', async () => {
    const y = String(new Date().getFullYear());
    const r = await svc.classifyIntent('ausencias este año');
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.year).toBe(y);
    expect(r.entidades?.mes).toBeUndefined();
  });

  it('que ausencias estan previstas para mañana → SOLICITUDES + fecha (mañana)', async () => {
    const r = await svc.classifyIntent(
      'que ausencias estan previstas para mañana',
    );
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 1);
    const exp = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    expect(r.entidades?.fecha).toBe(exp);
  });

  it('ausencias para los próximos 5 días → SOLICITUDES + proximos_dias 5', async () => {
    const r = await svc.classifyIntent('ausencias para los próximos 5 días');
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.proximos_dias).toBe(5);
    expect(r.entidades?.fecha).toBeUndefined();
  });

  it('care e orarul meu azi → CUADRANTE + fecha', async () => {
    const r = await svc.classifyIntent('care e orarul meu azi');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('horario de hoy → CUADRANTE + fecha', async () => {
    const r = await svc.classifyIntent('horario de hoy');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('orarul pentru azi → CUADRANTE + fecha', async () => {
    const r = await svc.classifyIntent('orarul pentru azi');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('este mes după fichajes luna asta → FICHAJES + lună curentă', async () => {
    const first = await svc.classifyIntent(
      'ce registre de fichajes am luna asta',
    );
    expect(first.intent).toBe(IntentType.FICHAJES);
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent('este mes');
    const r = svc.applyContextualFollowUp('este mes', raw, ctx);
    expect(r.intent).toBe(IntentType.FICHAJES);
    expect(r.entidades?.mes).toMatch(/^completo_/);
  });

  it('toate nominele → NOMINAS (RO)', async () => {
    const r = await svc.classifyIntent(
      'da poti sami arati toate nominele aici',
    );
    expect(r.intent).toBe(IntentType.NOMINAS);
  });

  it('pedido material mi centro este mes → PEDIDOS', async () => {
    const r = await svc.classifyIntent(
      'mi centro tengo algun pedido hecho este mes ?',
    );
    expect(r.intent).toBe(IntentType.PEDIDOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.65);
  });

  it('după CUADRANTE, întrebare pedidos → PEDIDOS (fără lipire context)', async () => {
    const first = await svc.classifyIntent('que horario tengo hoy');
    expect(first.intent).toBe(IntentType.CUADRANTE);
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent(
      'mi centro tengo algun pedido hecho este mes',
    );
    const r = svc.applyContextualFollowUp(
      'mi centro tengo algun pedido hecho este mes',
      raw,
      ctx,
    );
    expect(r.intent).toBe(IntentType.PEDIDOS);
  });

  it('hay comunicados nuevos → COMUNICADOS', async () => {
    const r = await svc.classifyIntent('hay comunicados nuevos');
    expect(r.intent).toBe(IntentType.COMUNICADOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.6);
  });

  it('mis solicitudes pendientes → SOLICITUDES', async () => {
    const r = await svc.classifyIntent('mis solicitudes pendientes');
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.soloPendientes).toBe(true);
  });

  it('Necesito mandar justificantes → PROCEDIMIENTOS (KB / cómo enviar, no DESCONOCIDO)', async () => {
    const r = await svc.classifyIntent('Necesito mandar justificantes');
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
  });

  it('justificantes sin verbo de procedimiento → SOLICITUDES', async () => {
    const r = await svc.classifyIntent('mis justificantes de ausencia');
    expect(r.intent).toBe(IntentType.SOLICITUDES);
  });

  it('documente lipsesc → DOCUMENTOS_SOLICITADOS', async () => {
    const r = await svc.classifyIntent('ce documente îmi lipsesc');
    expect(r.intent).toBe(IntentType.DOCUMENTOS_SOLICITADOS);
  });

  it('vacaciones pendientes → VACACIONES + soloPendientes', async () => {
    const r = await svc.classifyIntent('vacaciones pendientes');
    expect(r.intent).toBe(IntentType.VACACIONES);
    expect(r.entidades?.soloPendientes).toBe(true);
  });

  it('cum cer vacanță → PROCEDIMIENTOS (ghid utilizare, nu date vacanțe)', async () => {
    const r = await svc.classifyIntent('cum cer vacanță');
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.6);
  });

  it('como ver mi horario → PROCEDIMIENTOS (cómo usar), nu CUADRANTE', async () => {
    const r = await svc.classifyIntent('como ver mi horario');
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.6);
  });

  it('qué horario tengo hoy → rămâne CUADRANTE (întrebare de date, nu „cómo ver”)', async () => {
    const r = await svc.classifyIntent('qué horario tengo hoy');
    expect(r.intent).toBe(IntentType.CUADRANTE);
  });

  it('que horario tiene Anisoara hoy → CUADRANTE + fecha + entidad nombre', async () => {
    const r = await svc.classifyIntent('que horario tiene Anisoara hoy');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.nombre).toBe('Anisoara');
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('nombre en MAYÚSCULAS: de IORDACHE IONUT ADRIAN para hoy → CUADRANTE + nombre + fecha', async () => {
    const r = await svc.classifyIntent(
      'de IORDACHE IONUT ADRIAN para hoy qué horario tiene',
    );
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.nombre).toBe('IORDACHE IONUT ADRIAN');
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('horario de IORDACHE IONUT ADRIAN hoy → CUADRANTE + nombre + fecha', async () => {
    const r = await svc.classifyIntent('horario de IORDACHE IONUT ADRIAN hoy');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.nombre).toBe('IORDACHE IONUT ADRIAN');
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('horario de trabajo de IORDACHE IONUT ADRIAN para hoy → CUADRANTE + nombre + fecha', async () => {
    const r = await svc.classifyIntent(
      'horario de trabajo de IORDACHE IONUT ADRIAN para hoy',
    );
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.nombre).toBe('IORDACHE IONUT ADRIAN');
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('que horario tiene hoy IORDACHE IONUT ADRIAN → CUADRANTE + nombre + fecha (día antes del nombre)', async () => {
    const r = await svc.classifyIntent(
      'que horario tiene hoy IORDACHE IONUT ADRIAN',
    );
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.nombre).toBe('IORDACHE IONUT ADRIAN');
    expect(r.entidades?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('que horario tengo este mes → CUADRANTE + lună curentă (completo_*)', async () => {
    const r = await svc.classifyIntent('que horario tengo este mes ?');
    expect(r.intent).toBe(IntentType.CUADRANTE);
    expect(r.entidades?.mes).toMatch(/^completo_/);
  });

  it('quien tiene diplomas → DIPLOMAS', async () => {
    const r = await svc.classifyIntent('quien tiene diplomas');
    expect(r.intent).toBe(IntentType.DIPLOMAS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.35);
  });

  it('quien tiene certificaciones → DIPLOMAS', async () => {
    const r = await svc.classifyIntent('quien tiene certificaciones');
    expect(r.intent).toBe(IntentType.DIPLOMAS);
    expect(r.confianza).toBeGreaterThanOrEqual(0.35);
  });

  it('falta nomina febrero → NOMINAS + faltan_nominas + mes febrero', async () => {
    const r = await svc.classifyIntent('falta nomina febrero');
    expect(r.intent).toBe(IntentType.NOMINAS);
    expect(r.entidades?.faltan_nominas).toBe(true);
    expect(r.entidades?.mes).toBe('febrero');
  });

  it('nominas febrero → NOMINAS + mes febrero (sin faltan por defecto)', async () => {
    const r = await svc.classifyIntent('nominas febrero');
    expect(r.intent).toBe(IntentType.NOMINAS);
    expect(r.entidades?.mes).toBe('febrero');
    expect(r.entidades?.faltan_nominas).toBeFalsy();
  });

  it('falta nomina para algun empleado en mes de febrero → NOMINAS, no EMPLEADOS', async () => {
    const r = await svc.classifyIntent(
      'falta nomina para algun empleado en mes de febrero',
    );
    expect(r.intent).toBe(IntentType.NOMINAS);
    expect(r.entidades?.faltan_nominas).toBe(true);
    expect(r.entidades?.mes).toBe('febrero');
  });

  it('după NOMINAS, follow-up cu nominele rămâne NOMINAS chiar dacă raw alt intent slab', async () => {
    const first = await svc.classifyIntent('que nominas tengo subidas');
    expect(first.intent).toBe(IntentType.NOMINAS);
    const ctx: IntentContextSnapshot = {
      lastIntent: first.intent,
      lastEntities: first.entidades ?? null,
    };
    const raw = await svc.classifyIntent(
      'da poti sami arati toate nominele aici',
    );
    const r = svc.applyContextualFollowUp(
      'da poti sami arati toate nominele aici',
      raw,
      ctx,
    );
    expect(r.intent).toBe(IntentType.NOMINAS);
  });

  it('cuanto ausencias justificadas tengo este año → SOLICITUDES + year + tipo ausencia_justificada', async () => {
    const y = String(new Date().getFullYear());
    const r = await svc.classifyIntent(
      'cuanto ausencias justificadas tengo este año',
    );
    expect(r.intent).toBe(IntentType.SOLICITUDES);
    expect(r.entidades?.year).toBe(y);
    expect(r.entidades?.tipo).toBe('ausencia_justificada');
  });

  it('como subo un albaran ? → PEDIDOS (prioridad sobre procedimientos+KB genérico)', async () => {
    const r = await svc.classifyIntent('como subo un albaran ?');
    expect(r.intent).toBe(IntentType.PEDIDOS);
  });

  it('como mando un albaran ? → PEDIDOS (mando/mandar, no solo subir)', async () => {
    const r = await svc.classifyIntent('como mando un albaran ?');
    expect(r.intent).toBe(IntentType.PEDIDOS);
  });

  it('dónde subo el albarán → PEDIDOS', async () => {
    const r = await svc.classifyIntent('dónde subo el albarán');
    expect(r.intent).toBe(IntentType.PEDIDOS);
  });

  it('Quiero poner la direccion de mi casa y no me deja → PROCEDIMIENTOS (datos personales / app-help)', async () => {
    const r = await svc.classifyIntent(
      'Quiero poner la direccion de mi casa y no me deja',
    );
    expect(r.intent).toBe(IntentType.PROCEDIMIENTOS);
  });
});
