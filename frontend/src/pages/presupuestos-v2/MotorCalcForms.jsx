function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FieldNumber({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type="number"
        step="any"
        className="mt-1 w-full border rounded px-2 py-1.5"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </label>
  );
}

function FieldBool({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm mt-2">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

function FieldBc({ label, value, onChange }) {
  const v = value && typeof value === 'object' ? value : { b: 0, c: 0 };
  return (
    <div className="text-sm">
      <div className="text-gray-600 mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="any"
          className="border rounded px-2 py-1.5"
          placeholder="B"
          value={v.b ?? ''}
          onChange={(e) =>
            onChange({ ...v, b: e.target.value === '' ? 0 : Number(e.target.value) })
          }
        />
        <input
          type="number"
          step="any"
          className="border rounded px-2 py-1.5"
          placeholder="C"
          value={v.c ?? ''}
          onChange={(e) =>
            onChange({ ...v, c: e.target.value === '' ? 0 : Number(e.target.value) })
          }
        />
      </div>
    </div>
  );
}

function setPath(obj, key, val) {
  return { ...obj, [key]: val };
}

export function MotorInputsForm({ codigoMotor, inputs, onChange }) {
  const i = inputs || {};

  if (codigoMotor === 'precio_mensual') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-gray-600">Concepto</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={i.concepto || ''}
            onChange={(e) => onChange(setPath(i, 'concepto', e.target.value))}
          />
        </label>
        <FieldNumber
          label="Precio mensual sin IVA (€)"
          value={i.precioSinIva}
          onChange={(v) => onChange(setPath(i, 'precioSinIva', v))}
        />
      </div>
    );
  }

  if (codigoMotor === 'piscina') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">Concepto</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={i.concepto || ''}
              onChange={(e) => onChange(setPath(i, 'concepto', e.target.value))}
            />
          </label>
          <FieldNumber
            label="Precio temporada sin IVA (€)"
            value={i.precioSinIva}
            onChange={(v) => onChange(setPath(i, 'precioSinIva', v))}
          />
          <FieldNumber
            label="Extra €/mes"
            value={i.extra}
            onChange={(v) => onChange(setPath(i, 'extra', v))}
          />
          <label className="block text-sm">
            <span className="text-gray-600">Horas (texto)</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={i.horas || ''}
              onChange={(e) => onChange(setPath(i, 'horas', e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Días (texto)</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={i.dias || ''}
              onChange={(e) => onChange(setPath(i, 'dias', e.target.value))}
            />
          </label>
        </div>
        <div className="border-t pt-3 grid gap-3 sm:grid-cols-2">
          <FieldBool
            label="Incluir invernal con lona"
            value={i.incluirInvernalConLona !== false}
            onChange={(v) => onChange(setPath(i, 'incluirInvernalConLona', v))}
          />
          <FieldNumber
            label="Precio invernal con lona"
            value={i.precioConLona}
            onChange={(v) => onChange(setPath(i, 'precioConLona', v))}
          />
          <FieldBool
            label="Incluir invernal sin lona"
            value={i.incluirInvernalSinLona !== false}
            onChange={(v) => onChange(setPath(i, 'incluirInvernalSinLona', v))}
          />
          <FieldNumber
            label="Precio invernal sin lona"
            value={i.precioSinLona}
            onChange={(v) => onChange(setPath(i, 'precioSinLona', v))}
          />
          <FieldNumber
            label="Recuperación agua (info)"
            value={i.recuperacionAguaPrecio}
            onChange={(v) => onChange(setPath(i, 'recuperacionAguaPrecio', v))}
          />
        </div>
        <p className="text-xs text-amber-700">
          Legacy: el precio temporada se trata como base mensual en la oferta (×12 anual).
        </p>
      </div>
    );
  }

  if (codigoMotor === 'limpieza_coste') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldNumber label="Convenio base" value={i.convenioBase} onChange={(v) => onChange(setPath(i, 'convenioBase', v))} />
          <FieldNumber label="Nº operarias" value={i.numOperarias} onChange={(v) => onChange(setPath(i, 'numOperarias', v))} />
          <FieldNumber label="Horas/día/operaria" value={i.horasPorDiaPorOperaria} onChange={(v) => onChange(setPath(i, 'horasPorDiaPorOperaria', v))} />
          <FieldNumber label="Días laborables/sem" value={i.diasLaborablesSemana} onChange={(v) => onChange(setPath(i, 'diasLaborablesSemana', v))} />
          <FieldNumber label="Horas extra anual" value={i.serviciosExtraHoras} onChange={(v) => onChange(setPath(i, 'serviciosExtraHoras', v))} />
          <FieldNumber label="Extra €/mes" value={i.extra} onChange={(v) => onChange(setPath(i, 'extra', v))} />
          <FieldNumber label="Precio mensual forzado (opcional)" value={i.d48Manual ?? ''} onChange={(v) => onChange(setPath(i, 'd48Manual', v === '' ? null : v))} />
        </div>
        <FieldBool label="Aplicar limpieza Gajare" value={i.aplicaLimpiezaGajare !== false} onChange={(v) => onChange(setPath(i, 'aplicaLimpiezaGajare', v))} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldBc label="Uniformidad" value={i.uniformidad} onChange={(v) => onChange(setPath(i, 'uniformidad', v))} />
          <FieldBc label="Gestoría" value={i.gestoria} onChange={(v) => onChange(setPath(i, 'gestoria', v))} />
          <FieldBc label="Productos limpieza" value={i.productosLimpieza} onChange={(v) => onChange(setPath(i, 'productosLimpieza', v))} />
          <FieldBc label="Limpieza Gajare" value={i.limpiezaGajare} onChange={(v) => onChange(setPath(i, 'limpiezaGajare', v))} />
          <FieldBc label="Acristalado" value={i.acristalado} onChange={(v) => onChange(setPath(i, 'acristalado', v))} />
          <FieldBc label="Cristalero" value={i.cristalero} onChange={(v) => onChange(setPath(i, 'cristalero', v))} />
          <FieldBc label="Cubos" value={i.cubos} onChange={(v) => onChange(setPath(i, 'cubos', v))} />
          <FieldBc label="Teléfono" value={i.telefono} onChange={(v) => onChange(setPath(i, 'telefono', v))} />
          <FieldBc label="Vigilancia" value={i.vigilancia} onChange={(v) => onChange(setPath(i, 'vigilancia', v))} />
          <FieldBc label="Gastos fijo (€/h)" value={i.gastosFijoHoras} onChange={(v) => onChange(setPath(i, 'gastosFijoHoras', v))} />
          <FieldBc label="Beneficio empresarial" value={i.beneficioEmpresarial} onChange={(v) => onChange(setPath(i, 'beneficioEmpresarial', v))} />
        </div>
      </div>
    );
  }

  // auxiliares_coste (default)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FieldNumber label="Convenio base" value={i.convenioBase} onChange={(v) => onChange(setPath(i, 'convenioBase', v))} />
        <FieldNumber label="Horas / día" value={i.horasDiarias} onChange={(v) => onChange(setPath(i, 'horasDiarias', v))} />
        <FieldNumber label="Días / semana" value={i.diasPorSemana} onChange={(v) => onChange(setPath(i, 'diasPorSemana', v))} />
        <FieldNumber label="Horas a cubrir / sem" value={i.horasACubrirPorSemana} onChange={(v) => onChange(setPath(i, 'horasACubrirPorSemana', v))} />
        <FieldNumber label="Extra €/mes" value={i.extra} onChange={(v) => onChange(setPath(i, 'extra', v))} />
      </div>
      <div className="flex flex-wrap gap-4">
        <FieldBool label="Sin festivos" value={!!i.sinFestivos} onChange={(v) => onChange(setPath(i, 'sinFestivos', v))} />
        <FieldBool label="Nocturnidad" value={!!i.aplicaNocturnidad} onChange={(v) => onChange(setPath(i, 'aplicaNocturnidad', v))} />
        <FieldBool label="Fin de semana" value={!!i.aplicaFinDeSemana} onChange={(v) => onChange(setPath(i, 'aplicaFinDeSemana', v))} />
        <FieldBool label="Servicios extra" value={!!i.aplicaServiciosExtra} onChange={(v) => onChange(setPath(i, 'aplicaServiciosExtra', v))} />
        <FieldBool label="Uniformidad auto" value={i.aplicaUniformidadAuto !== false} onChange={(v) => onChange(setPath(i, 'aplicaUniformidadAuto', v))} />
        <FieldBool label="Gestoría auto" value={i.aplicaGestoriaAuto !== false} onChange={(v) => onChange(setPath(i, 'aplicaGestoriaAuto', v))} />
      </div>
      {i.aplicaNocturnidad && (
        <FieldBc label="Nocturnidad B×C" value={i.nocturnidad} onChange={(v) => onChange(setPath(i, 'nocturnidad', v))} />
      )}
      {i.aplicaFinDeSemana && (
        <FieldBc label="Fin de semana B×C" value={i.finDeSemana} onChange={(v) => onChange(setPath(i, 'finDeSemana', v))} />
      )}
      {i.aplicaServiciosExtra && (
        <FieldNumber label="Horas servicios extra" value={i.serviciosExtraHoras} onChange={(v) => onChange(setPath(i, 'serviciosExtraHoras', v))} />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FieldBc label="Uniformidad" value={i.uniformidad} onChange={(v) => onChange(setPath(i, 'uniformidad', v))} />
        <FieldBc label="Gestoría" value={i.gestoria} onChange={(v) => onChange(setPath(i, 'gestoria', v))} />
        <FieldBc label="Productos limpieza" value={i.productosLimpieza} onChange={(v) => onChange(setPath(i, 'productosLimpieza', v))} />
        <FieldBc label="Limpieza Gajare" value={i.limpiezaGajare} onChange={(v) => onChange(setPath(i, 'limpiezaGajare', v))} />
        <FieldBc label="Acristalado" value={i.acristalado} onChange={(v) => onChange(setPath(i, 'acristalado', v))} />
        <FieldBc label="Cristalero" value={i.cristalero} onChange={(v) => onChange(setPath(i, 'cristalero', v))} />
        <FieldBc label="Cubos" value={i.cubos} onChange={(v) => onChange(setPath(i, 'cubos', v))} />
        <FieldBc label="Teléfono" value={i.telefono} onChange={(v) => onChange(setPath(i, 'telefono', v))} />
        <FieldBc label="Vigilancia" value={i.vigilancia} onChange={(v) => onChange(setPath(i, 'vigilancia', v))} />
        <FieldBc label="Gastos fijo horas" value={i.gastosFijoHoras} onChange={(v) => onChange(setPath(i, 'gastosFijoHoras', v))} />
        <FieldBc label="Beneficio empresarial" value={i.beneficioEmpresarial} onChange={(v) => onChange(setPath(i, 'beneficioEmpresarial', v))} />
      </div>
    </div>
  );
}

export function ResultadoBreakdown({ resultado, commercialOnly = false }) {
  const tot = resultado?.totales || {};

  if (!resultado) {
    return <p className="text-sm text-slate-500">Sin cálculo todavía.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Mensual sin IVA</div>
          <div className="font-semibold text-slate-900">
            {money(tot.mensualidad_sin_iva)} €
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Mensual con IVA</div>
          <div className="font-semibold text-slate-900">
            {money(tot.mensualidad_con_iva)} €
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Anual sin IVA</div>
          <div className="font-semibold text-slate-900">
            {money(tot.anualidad_sin_iva)} €
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Anual con IVA</div>
          <div className="font-semibold text-slate-900">
            {money(tot.anualidad_con_iva)} €
          </div>
        </div>
      </div>
      {resultado.descripcion && (
        <p className="text-sm text-slate-700">{resultado.descripcion}</p>
      )}
      {!commercialOnly && (resultado.warnings || []).length > 0 && (
        <ul className="text-xs text-amber-700 list-disc pl-4">
          {resultado.warnings.map((w, idx) => (
            <li key={idx}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { money };
