/** Client working copy + fingerprint helpers for Presupuestos V2. */

export type ClienteFichaSnapshot = {
  cliente_id: number;
  nombre: string | null;
  nif: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  poblacion: string | null;
  provincia: string | null;
  pais: string | null;
  email: string | null;
  telefono: string | null;
  movil: string | null;
  contacto_principal?: {
    id: number;
    nombre: string;
    email: string | null;
    telefono: string | null;
    cargo: string | null;
  } | null;
};

export type ClienteOverrides = {
  direccion_servicio?: string | null;
  contacto_especifico?: string | null;
  email_envio?: string | null;
  atencion_de?: string | null;
  observaciones_documento?: string | null;
  contacto_id?: number | null;
};

export type ClienteWorking = {
  source_cliente_id: number | null;
  ficha: ClienteFichaSnapshot | null;
  ficha_fingerprint: string | null;
  synced_at: string | null;
};

export function fingerprintFicha(ficha: ClienteFichaSnapshot | null): string {
  if (!ficha) return '';
  const payload = {
    cliente_id: ficha.cliente_id,
    nombre: ficha.nombre || '',
    nif: ficha.nif || '',
    direccion: ficha.direccion || '',
    codigo_postal: ficha.codigo_postal || '',
    poblacion: ficha.poblacion || '',
    provincia: ficha.provincia || '',
    pais: ficha.pais || '',
    email: ficha.email || '',
    telefono: ficha.telefono || '',
    movil: ficha.movil || '',
    contacto_principal: ficha.contacto_principal
      ? {
          id: ficha.contacto_principal.id,
          nombre: ficha.contacto_principal.nombre || '',
          email: ficha.contacto_principal.email || '',
          telefono: ficha.contacto_principal.telefono || '',
        }
      : null,
  };
  return JSON.stringify(payload);
}

export function mapClienteRowToFicha(row: {
  id: number;
  NOMBRE_O_RAZON_SOCIAL?: string | null;
  NIF?: string | null;
  DIRECCION?: string | null;
  CODIGO_POSTAL?: string | null;
  POBLACION?: string | null;
  PROVINCIA?: string | null;
  PAIS?: string | null;
  EMAIL?: string | null;
  TELEFONO?: string | null;
  MOVIL?: string | null;
  contactos?: Array<{
    id: number;
    nombre: string;
    email: string | null;
    telefono: string | null;
    cargo_codigo: string | null;
    cargo_libre: string | null;
    es_principal: boolean;
    estado: string;
  }>;
}): ClienteFichaSnapshot {
  const principal =
    (row.contactos || []).find(
      (c) => c.es_principal && c.estado === 'activo',
    ) ||
    (row.contactos || []).find((c) => c.estado === 'activo') ||
    null;

  return {
    cliente_id: row.id,
    nombre: row.NOMBRE_O_RAZON_SOCIAL?.trim() || null,
    nif: row.NIF?.trim() || null,
    direccion: row.DIRECCION?.trim() || null,
    codigo_postal: row.CODIGO_POSTAL?.trim() || null,
    poblacion: row.POBLACION?.trim() || null,
    provincia: row.PROVINCIA?.trim() || null,
    pais: row.PAIS?.trim() || null,
    email: row.EMAIL?.trim() || null,
    telefono: row.TELEFONO?.trim() || null,
    movil: row.MOVIL?.trim() || null,
    contacto_principal: principal
      ? {
          id: principal.id,
          nombre: principal.nombre,
          email: principal.email,
          telefono: principal.telefono,
          cargo: principal.cargo_libre || principal.cargo_codigo,
        }
      : null,
  };
}

export function buildWorkingFromFicha(
  ficha: ClienteFichaSnapshot | null,
  clienteId: number | null,
): ClienteWorking {
  return {
    source_cliente_id: clienteId,
    ficha,
    ficha_fingerprint: fingerprintFicha(ficha),
    synced_at: new Date().toISOString(),
  };
}

/** Merge ficha + overrides for document use (overrides never write back to Clientes). */
export function resolveClienteEfectivo(
  working: ClienteWorking | null | undefined,
  overrides: ClienteOverrides | null | undefined,
): Record<string, unknown> | null {
  if (!working?.ficha && !overrides) return null;
  const f = working?.ficha || ({} as ClienteFichaSnapshot);
  const o = overrides || {};
  return {
    cliente_id: working?.source_cliente_id ?? f.cliente_id ?? null,
    nombre: f.nombre ?? null,
    nif: f.nif ?? null,
    direccion: f.direccion ?? null,
    codigo_postal: f.codigo_postal ?? null,
    poblacion: f.poblacion ?? null,
    provincia: f.provincia ?? null,
    pais: f.pais ?? null,
    email: f.email ?? null,
    telefono: f.telefono ?? null,
    movil: f.movil ?? null,
    contacto_principal: f.contacto_principal ?? null,
    direccion_servicio: o.direccion_servicio ?? null,
    contacto_especifico: o.contacto_especifico ?? null,
    email_envio: o.email_envio ?? f.email ?? null,
    atencion_de: o.atencion_de ?? null,
    observaciones_documento: o.observaciones_documento ?? null,
    contacto_id: o.contacto_id ?? f.contacto_principal?.id ?? null,
  };
}

export function detectFichaStale(
  working: ClienteWorking | null | undefined,
  liveFicha: ClienteFichaSnapshot | null,
): boolean {
  if (!working?.source_cliente_id || !liveFicha) return false;
  const liveFp = fingerprintFicha(liveFicha);
  return (
    Boolean(working.ficha_fingerprint) && working.ficha_fingerprint !== liveFp
  );
}

/**
 * Refresh ficha into working copy; keep overrides untouched.
 */
export function refreshWorkingFicha(
  working: ClienteWorking | null | undefined,
  liveFicha: ClienteFichaSnapshot,
): ClienteWorking {
  return {
    source_cliente_id: liveFicha.cliente_id,
    ficha: liveFicha,
    ficha_fingerprint: fingerprintFicha(liveFicha),
    synced_at: new Date().toISOString(),
  };
}
