import { moneyEs } from './v2UiHelpers';
import {
  auxiliaresB4,
  auxiliaresHeadcount,
  bc,
  fmtQty,
  limpiezaB4,
  n,
  pairSubtotalBeneficio,
  pairSubtotalGastosFijoAux,
  pairSubtotalGastosFijoLimp,
  pairSubtotalMensualAnual,
  pairSubtotalNoctOrFds,
  pairSubtotalSimple,
} from './motorCalcUx';

function FieldNumber({ label, value, onChange, hint, disabled }) {
  return (
    <label className={`block text-sm ${disabled ? 'opacity-60' : ''}`}>
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        step="any"
        disabled={disabled}
        className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-slate-50"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
      />
      {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function FieldBool({ label, value, onChange, hint }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-slate-800">{label}</span>
        {hint ? (
          <span className="block text-xs text-slate-500 font-normal">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function FieldText({ label, value, onChange, hint }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function FormSection({ title, children, className = '' }) {
  return (
    <section className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-1">
        {title}
      </h4>
      {children}
    </section>
  );
}

function ReadOnlyLine({ children }) {
  return (
    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
      {children}
    </p>
  );
}

function SubtotalLine({ text }) {
  if (!text) return null;
  return (
    <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
      <span className="text-slate-400">= </span>
      {text}
    </p>
  );
}

/**
 * Concepto with labeled B × C inputs + optional subtotal.
 */
function FieldPair({
  title,
  labelB,
  labelC,
  value,
  onChange,
  subtotalText,
  hideC = false,
  cReadOnly = false,
  cDisplay,
  className = '',
}) {
  const v = value && typeof value === 'object' ? value : { b: 0, c: 0 };
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-3 ${className}`}
    >
      <div className="text-sm font-medium text-slate-800 mb-2">{title}</div>
      <div className={`grid gap-2 ${hideC ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <label className="block text-sm">
          <span className="text-slate-600 text-xs">{labelB}</span>
          <input
            type="number"
            step="any"
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5"
            value={v.b ?? ''}
            onChange={(e) =>
              onChange({
                ...v,
                b: e.target.value === '' ? 0 : Number(e.target.value),
              })
            }
          />
        </label>
        {!hideC && (
          <label className="block text-sm">
            <span className="text-slate-600 text-xs">{labelC}</span>
            {cReadOnly ? (
              <div className="mt-1 w-full border border-slate-100 rounded-lg px-2 py-1.5 bg-slate-50 tabular-nums text-slate-800">
                {cDisplay ?? v.c ?? '—'}
              </div>
            ) : (
              <input
                type="number"
                step="any"
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5"
                value={v.c ?? ''}
                onChange={(e) =>
                  onChange({
                    ...v,
                    c: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
            )}
          </label>
        )}
      </div>
      <SubtotalLine text={subtotalText} />
    </div>
  );
}

function setPath(obj, key, val) {
  return { ...obj, [key]: val };
}

function AuxiliaresForm({ inputs, onChange, resultado }) {
  const i = inputs || {};
  const hd = auxiliaresHeadcount(i, resultado);
  const B4 = auxiliaresB4(i, resultado);
  const autoUnif = i.aplicaUniformidadAuto !== false;
  const autoGest = i.aplicaGestoriaAuto !== false;

  const unif = bc(i.uniformidad, { b: 150, c: 2 });
  const gest = bc(i.gestoria, { b: 120, c: 2 });
  const prod = bc(i.productosLimpieza, { b: 30, c: 12 });
  const gaj = bc(i.limpiezaGajare, { b: 300, c: 0 });
  const acr = bc(i.acristalado, { b: 125, c: 0 });
  const cris = bc(i.cristalero, { b: 90, c: 0 });
  const cub = bc(i.cubos, { b: 15, c: 0 });
  const tel = bc(i.telefono, { b: 22, c: 1 });
  const vig = bc(i.vigilancia, { b: 8.4, c: 1 });
  const gasto = bc(i.gastosFijoHoras, { b: 1.1, c: 0 });
  const benef = bc(i.beneficioEmpresarial, { b: 0, c: 1 });
  const noct = bc(i.nocturnidad, { b: 0, c: 0.77 });
  const fds = bc(i.finDeSemana, { b: 952, c: 0.22 });

  return (
    <div className="space-y-5">
      <FormSection title="Jornada">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldNumber
            label="Horas/día (1 trabajador)"
            value={i.horasDiarias}
            onChange={(v) => onChange(setPath(i, 'horasDiarias', v))}
          />
          <FieldNumber
            label="Días/semana (1 trabajador)"
            value={i.diasPorSemana}
            onChange={(v) => onChange(setPath(i, 'diasPorSemana', v))}
          />
          <FieldNumber
            label="Horas a cubrir del servicio/semana"
            value={i.horasACubrirPorSemana}
            onChange={(v) => onChange(setPath(i, 'horasACubrirPorSemana', v))}
            hint="Nº conserjes ≈ horas ÷ 40"
          />
          <div className="flex items-end pb-1">
            <FieldBool
              label="Sin festivos"
              value={!!i.sinFestivos}
              onChange={(v) => onChange(setPath(i, 'sinFestivos', v))}
              hint="Solo texto de oferta; no cambia el cálculo"
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ReadOnlyLine>
            Horas/semana del trabajador (B4):{' '}
            <strong className="tabular-nums">{fmtQty(B4, 2)} h</strong>
          </ReadOnlyLine>
          <ReadOnlyLine>
            Conserjes necesarios:{' '}
            <strong className="tabular-nums">
              {fmtQty(hd.numConserjeNecesarios, 2)}
            </strong>
          </ReadOnlyLine>
        </div>
      </FormSection>

      <FormSection title="Salario y convenio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldNumber
            label="Salario convenio (€/mes)"
            value={i.convenioBase}
            onChange={(v) => onChange(setPath(i, 'convenioBase', v))}
            hint="Base × 14 pagas en el motor"
          />
        </div>
      </FormSection>

      <FormSection title="Suplementos">
        <div className="space-y-3">
          <FieldBool
            label="Aplicar nocturnidad"
            value={!!i.aplicaNocturnidad}
            onChange={(v) => onChange(setPath(i, 'aplicaNocturnidad', v))}
          />
          {i.aplicaNocturnidad ? (
            <FieldPair
              title="Nocturnidad"
              labelB="Base"
              labelC="Coeficiente"
              value={i.nocturnidad}
              onChange={(v) => onChange(setPath(i, 'nocturnidad', v))}
              subtotalText={
                pairSubtotalNoctOrFds(noct.b, noct.c, 'D12', resultado).text
              }
            />
          ) : null}

          <FieldBool
            label="Aplicar fin de semana y festivos"
            value={!!i.aplicaFinDeSemana}
            onChange={(v) => onChange(setPath(i, 'aplicaFinDeSemana', v))}
          />
          {i.aplicaFinDeSemana ? (
            <FieldPair
              title="Fin de semana y festivos"
              labelB="Base (horas estimadas)"
              labelC="Coeficiente"
              value={i.finDeSemana}
              onChange={(v) => onChange(setPath(i, 'finDeSemana', v))}
              subtotalText={
                pairSubtotalNoctOrFds(fds.b, fds.c, 'D14', resultado).text
              }
            />
          ) : null}

          <FieldBool
            label="Aplicar servicios extra (horas extra anuales)"
            value={!!i.aplicaServiciosExtra}
            onChange={(v) => onChange(setPath(i, 'aplicaServiciosExtra', v))}
          />
          {i.aplicaServiciosExtra ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 max-w-md">
              <FieldNumber
                label="Horas extra anuales"
                value={i.serviciosExtraHoras}
                onChange={(v) => onChange(setPath(i, 'serviciosExtraHoras', v))}
                hint="Coste = horas × (salario anual ÷ 156)"
              />
              {resultado?.breakdown?.D16 != null ? (
                <SubtotalLine
                  text={`Coste calculado: ${moneyEs(resultado.breakdown.D16)} €/año`}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Personal y gestión">
        <div className="flex flex-wrap gap-4 mb-2">
          <FieldBool
            label="Uniformidad automática"
            value={autoUnif}
            onChange={(v) => onChange(setPath(i, 'aplicaUniformidadAuto', v))}
            hint="Empleados = ⌊conserjes⌋; uniformes = empleados + 1"
          />
          <FieldBool
            label="Gestoría automática"
            value={autoGest}
            onChange={(v) => onChange(setPath(i, 'aplicaGestoriaAuto', v))}
            hint="Empleados = ⌊conserjes⌋"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {autoUnif ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-1">
              <div className="text-sm font-medium text-slate-800 mb-2">
                Uniformidad
              </div>
              <FieldNumber
                label="Coste por uniforme (€)"
                value={unif.b}
                onChange={(v) =>
                  onChange(
                    setPath(i, 'uniformidad', { ...unif, b: v === '' ? 0 : v }),
                  )
                }
              />
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>
                  Empleados estimados:{' '}
                  <strong className="tabular-nums">{fmtQty(hd.numEmpleados, 0)}</strong>
                </p>
                <p>
                  Uniformes calculados:{' '}
                  <strong className="tabular-nums">{fmtQty(hd.numUniformes, 0)}</strong>
                </p>
                <SubtotalLine
                  text={`${moneyEs(unif.b)} € × ${fmtQty(hd.numUniformes, 0)} uniformes = ${moneyEs(hd.costeUnif)} €/año`}
                />
              </div>
            </div>
          ) : (
            <>
              <FieldNumber
                label="Nº empleados (manual)"
                value={i.numEmpleadosManual}
                onChange={(v) => onChange(setPath(i, 'numEmpleadosManual', v))}
                hint="Informativo en breakdown; el coste usa nº uniformes"
              />
              <FieldPair
                title="Uniformidad"
                labelB="Coste por uniforme (€)"
                labelC="Nº uniformes"
                value={i.uniformidad}
                onChange={(v) => onChange(setPath(i, 'uniformidad', v))}
                subtotalText={
                  pairSubtotalSimple(
                    unif.b,
                    unif.c,
                    'uniformes',
                    'D24',
                    resultado,
                  ).text
                }
              />
            </>
          )}

          {autoGest ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-sm font-medium text-slate-800 mb-2">
                Gestoría
              </div>
              <FieldNumber
                label="Coste gestoría por empleado (€)"
                value={gest.b}
                onChange={(v) =>
                  onChange(
                    setPath(i, 'gestoria', { ...gest, b: v === '' ? 0 : v }),
                  )
                }
              />
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>
                  Nº empleados calculado:{' '}
                  <strong className="tabular-nums">
                    {fmtQty(hd.numEmpleadosGestoria, 0)}
                  </strong>
                </p>
                <SubtotalLine
                  text={`${moneyEs(gest.b)} € × ${fmtQty(hd.numEmpleadosGestoria, 0)} empleados = ${moneyEs(hd.costeGest)} €/año`}
                />
              </div>
            </div>
          ) : (
            <FieldPair
              title="Gestoría"
              labelB="Coste gestoría por empleado (€)"
              labelC="Nº empleados"
              value={i.gestoria}
              onChange={(v) => onChange(setPath(i, 'gestoria', v))}
              subtotalText={
                pairSubtotalSimple(
                  gest.b,
                  gest.c,
                  'empleados',
                  'D26',
                  resultado,
                ).text
              }
            />
          )}
        </div>
      </FormSection>

      <FormSection title="Costes del servicio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Productos limpieza"
            labelB="Importe (€)"
            labelC="Cantidad"
            value={i.productosLimpieza}
            onChange={(v) => onChange(setPath(i, 'productosLimpieza', v))}
            subtotalText={
              pairSubtotalSimple(prod.b, prod.c, '', 'D28', resultado).text
            }
          />
          <FieldPair
            title="Teléfono"
            labelB="Importe mensual (€)"
            labelC="Nº líneas/unidades"
            value={i.telefono}
            onChange={(v) => onChange(setPath(i, 'telefono', v))}
            subtotalText={
              pairSubtotalMensualAnual(
                tel.b,
                tel.c,
                'líneas',
                'D38',
                resultado,
              ).text
            }
          />
          <FieldPair
            title="Vigilancia"
            labelB="Importe mensual (€)"
            labelC="Cantidad"
            value={i.vigilancia}
            onChange={(v) => onChange(setPath(i, 'vigilancia', v))}
            subtotalText={
              pairSubtotalMensualAnual(vig.b, vig.c, '', 'D40', resultado).text
            }
          />
          <FieldPair
            title="Gastos fijos / horas servicio"
            labelB="Coste fijo (€/h)"
            labelC="Horas servicio/semana"
            value={i.gastosFijoHoras}
            onChange={(v) => onChange(setPath(i, 'gastosFijoHoras', v))}
            subtotalText={
              pairSubtotalGastosFijoAux(gasto.b, gasto.c, resultado).text
            }
          />
        </div>
      </FormSection>

      <FormSection title="Servicios periódicos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Limpieza garaje"
            labelB="Importe por limpieza (€)"
            labelC="Nº limpiezas"
            value={i.limpiezaGajare}
            onChange={(v) => onChange(setPath(i, 'limpiezaGajare', v))}
            subtotalText={
              pairSubtotalSimple(gaj.b, gaj.c, 'limpiezas', 'D30', resultado)
                .text
            }
          />
          <FieldPair
            title="Acristalado"
            labelB="Importe por acristalado (€)"
            labelC="Nº acristalados"
            value={i.acristalado}
            onChange={(v) => onChange(setPath(i, 'acristalado', v))}
            subtotalText={
              pairSubtotalSimple(
                acr.b,
                acr.c,
                'acristalados',
                'D32',
                resultado,
              ).text
            }
          />
          <FieldPair
            title="Cristalero"
            labelB="Importe unitario (€)"
            labelC="Cantidad"
            value={i.cristalero}
            onChange={(v) => onChange(setPath(i, 'cristalero', v))}
            subtotalText={
              pairSubtotalSimple(cris.b, cris.c, '', 'D34', resultado).text
            }
          />
          <FieldPair
            title="Cubos"
            labelB="Importe unitario (€)"
            labelC="Cantidad"
            value={i.cubos}
            onChange={(v) => onChange(setPath(i, 'cubos', v))}
            subtotalText={
              pairSubtotalSimple(cub.b, cub.c, '', 'D36', resultado).text
            }
          />
        </div>
      </FormSection>

      <FormSection title="Margen / ajuste comercial">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Beneficio empresarial"
            labelB="Beneficio mensual (€)"
            labelC="Cantidad"
            value={i.beneficioEmpresarial}
            onChange={(v) => onChange(setPath(i, 'beneficioEmpresarial', v))}
            subtotalText={
              pairSubtotalBeneficio(benef.b, benef.c, 'D44', resultado).text
            }
          />
          <FieldNumber
            label="Extra oferta (€/mes)"
            value={i.extra}
            onChange={(v) => onChange(setPath(i, 'extra', v))}
            hint="Se suma al resultado final de oferta"
          />
        </div>
        <p className="text-xs text-slate-500">
          El beneficio no es un porcentaje: es importe mensual × cantidad × 12.
        </p>
      </FormSection>
    </div>
  );
}

function LimpiezaForm({ inputs, onChange, resultado }) {
  const i = inputs || {};
  const B4 = limpiezaB4(i, resultado);
  const unif = bc(i.uniformidad, { b: 150, c: 2 });
  const gest = bc(i.gestoria, { b: 120, c: 2 });
  const prod = bc(i.productosLimpieza, { b: 150, c: 12 });
  const gaj = bc(i.limpiezaGajare, { b: 450, c: 2 });
  const acr = bc(i.acristalado, { b: 250, c: 1 });
  const cris = bc(i.cristalero, { b: 90, c: 0 });
  const cub = bc(i.cubos, { b: 8, c: 0 });
  const tel = bc(i.telefono, { b: 22, c: 0 });
  const vig = bc(i.vigilancia, { b: 8.4, c: 2 });
  const gastoB = n(
    i.gastosFijoHoras && typeof i.gastosFijoHoras === 'object'
      ? i.gastosFijoHoras.b
      : i.gastosFijoHoras,
    1.1,
  );
  const benef = bc(i.beneficioEmpresarial, { b: 150, c: 1 });
  const aplicaGaj = i.aplicaLimpiezaGajare !== false;
  const gastosSub = pairSubtotalGastosFijoLimp(gastoB, B4, resultado);

  return (
    <div className="space-y-5">
      <FormSection title="Jornada y personal">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldNumber
            label="Nº operarias"
            value={i.numOperarias}
            onChange={(v) => onChange(setPath(i, 'numOperarias', v))}
          />
          <FieldNumber
            label="Horas/día por operaria"
            value={i.horasPorDiaPorOperaria}
            onChange={(v) => onChange(setPath(i, 'horasPorDiaPorOperaria', v))}
          />
          <FieldNumber
            label="Días laborables/semana"
            value={i.diasLaborablesSemana}
            onChange={(v) => onChange(setPath(i, 'diasLaborablesSemana', v))}
          />
          <FieldNumber
            label="Horas extra anuales"
            value={i.serviciosExtraHoras}
            onChange={(v) => onChange(setPath(i, 'serviciosExtraHoras', v))}
            hint="Coste = horas × (salario anual ÷ 156)"
          />
        </div>
        <ReadOnlyLine>
          Horas semanales calculadas (B4):{' '}
          <strong className="tabular-nums">{fmtQty(B4, 2)} h</strong>
        </ReadOnlyLine>
      </FormSection>

      <FormSection title="Salario y convenio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldNumber
            label="Salario convenio (€/mes)"
            value={i.convenioBase}
            onChange={(v) => onChange(setPath(i, 'convenioBase', v))}
            hint="Base × 12 pagas en el motor"
          />
          <FieldNumber
            label="Precio mensual forzado (opcional)"
            value={i.d48Manual ?? ''}
            onChange={(v) =>
              onChange(setPath(i, 'd48Manual', v === '' ? null : v))
            }
            hint="Vacío = usar cálculo del motor"
          />
        </div>
      </FormSection>

      <FormSection title="Personal y gestión">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Uniformidad"
            labelB="Coste por uniforme (€)"
            labelC="Nº uniformes"
            value={i.uniformidad}
            onChange={(v) => onChange(setPath(i, 'uniformidad', v))}
            subtotalText={
              pairSubtotalSimple(unif.b, unif.c, 'uniformes', 'D20', resultado)
                .text
            }
          />
          <FieldPair
            title="Gestoría"
            labelB="Coste gestoría por empleado (€)"
            labelC="Nº empleados"
            value={i.gestoria}
            onChange={(v) => onChange(setPath(i, 'gestoria', v))}
            subtotalText={
              pairSubtotalSimple(gest.b, gest.c, 'empleados', 'D22', resultado)
                .text
            }
          />
        </div>
      </FormSection>

      <FormSection title="Costes del servicio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Productos limpieza"
            labelB="Importe (€)"
            labelC="Cantidad"
            value={i.productosLimpieza}
            onChange={(v) => onChange(setPath(i, 'productosLimpieza', v))}
            subtotalText={
              pairSubtotalSimple(prod.b, prod.c, '', 'D24', resultado).text
            }
          />
          <FieldPair
            title="Teléfono"
            labelB="Importe mensual (€)"
            labelC="Nº líneas/unidades"
            value={i.telefono}
            onChange={(v) => onChange(setPath(i, 'telefono', v))}
            subtotalText={
              pairSubtotalMensualAnual(
                tel.b,
                tel.c,
                'líneas',
                'D34',
                resultado,
              ).text
            }
          />
          <FieldPair
            title="Vigilancia"
            labelB="Importe mensual (€)"
            labelC="Cantidad"
            value={i.vigilancia}
            onChange={(v) => onChange(setPath(i, 'vigilancia', v))}
            subtotalText={
              pairSubtotalMensualAnual(vig.b, vig.c, '', 'D36', resultado).text
            }
          />
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-medium text-slate-800 mb-2">
              Gastos fijos / horas servicio
            </div>
            <FieldNumber
              label="Coste fijo (€/h)"
              value={gastoB}
              onChange={(v) =>
                onChange(
                  setPath(i, 'gastosFijoHoras', {
                    ...(typeof i.gastosFijoHoras === 'object'
                      ? i.gastosFijoHoras
                      : {}),
                    b: v === '' ? 0 : v,
                  }),
                )
              }
            />
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                Horas semanales calculadas:{' '}
                <strong className="tabular-nums">{fmtQty(B4, 2)} h</strong>
              </p>
              <SubtotalLine text={gastosSub.text} />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Servicios periódicos">
        <div className="space-y-3">
          <FieldBool
            label="Incluir limpieza garaje"
            value={aplicaGaj}
            onChange={(v) => onChange(setPath(i, 'aplicaLimpiezaGajare', v))}
          />
          {aplicaGaj ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FieldPair
                title="Limpieza garaje"
                labelB="Importe por limpieza (€)"
                labelC="Nº limpiezas"
                value={i.limpiezaGajare}
                onChange={(v) => onChange(setPath(i, 'limpiezaGajare', v))}
                subtotalText={
                  pairSubtotalSimple(
                    gaj.b,
                    gaj.c,
                    'limpiezas',
                    'D26',
                    resultado,
                  ).text
                }
              />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FieldPair
              title="Acristalado"
              labelB="Importe por acristalado (€)"
              labelC="Nº acristalados"
              value={i.acristalado}
              onChange={(v) => onChange(setPath(i, 'acristalado', v))}
              subtotalText={
                pairSubtotalSimple(
                  acr.b,
                  acr.c,
                  'acristalados',
                  'D28',
                  resultado,
                ).text
              }
            />
            <FieldPair
              title="Cristalero"
              labelB="Importe unitario (€)"
              labelC="Cantidad"
              value={i.cristalero}
              onChange={(v) => onChange(setPath(i, 'cristalero', v))}
              subtotalText={
                pairSubtotalSimple(cris.b, cris.c, '', 'D30', resultado).text
              }
            />
            <FieldPair
              title="Cubos"
              labelB="Importe unitario (€)"
              labelC="Cantidad"
              value={i.cubos}
              onChange={(v) => onChange(setPath(i, 'cubos', v))}
              subtotalText={
                pairSubtotalSimple(cub.b, cub.c, '', 'D32', resultado).text
              }
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Margen / ajuste comercial">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldPair
            title="Beneficio empresarial"
            labelB="Beneficio mensual (€)"
            labelC="Cantidad"
            value={i.beneficioEmpresarial}
            onChange={(v) => onChange(setPath(i, 'beneficioEmpresarial', v))}
            subtotalText={
              pairSubtotalBeneficio(benef.b, benef.c, 'D40', resultado).text
            }
          />
          <FieldNumber
            label="Extra oferta (€/mes)"
            value={i.extra}
            onChange={(v) => onChange(setPath(i, 'extra', v))}
            hint="Se suma al resultado final de oferta"
          />
        </div>
        <p className="text-xs text-slate-500">
          El beneficio no es un porcentaje: es importe mensual × cantidad × 12.
        </p>
      </FormSection>
    </div>
  );
}

function PrecioMensualForm({ inputs, onChange }) {
  const i = inputs || {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FieldText
        label="Concepto"
        value={i.concepto}
        onChange={(v) => onChange(setPath(i, 'concepto', v))}
      />
      <FieldNumber
        label="Precio mensual sin IVA (€)"
        value={i.precioSinIva}
        onChange={(v) => onChange(setPath(i, 'precioSinIva', v))}
      />
    </div>
  );
}

function PiscinaForm({ inputs, onChange }) {
  const i = inputs || {};
  return (
    <div className="space-y-4">
      <FormSection title="Temporada / oferta">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldText
              label="Concepto"
              value={i.concepto}
              onChange={(v) => onChange(setPath(i, 'concepto', v))}
            />
          </div>
          <FieldNumber
            label="Precio base sin IVA (€)"
            value={i.precioSinIva}
            onChange={(v) => onChange(setPath(i, 'precioSinIva', v))}
            hint="Históricamente «temporada»: el motor lo trata como base mensual ×12 en la oferta (comportamiento Legacy)."
          />
          <FieldNumber
            label="Extra (€/mes)"
            value={i.extra}
            onChange={(v) => onChange(setPath(i, 'extra', v))}
          />
          <FieldText
            label="Horas (texto oferta)"
            value={i.horas}
            onChange={(v) => onChange(setPath(i, 'horas', v))}
            hint="Solo descripción; no entra en el cálculo"
          />
          <FieldText
            label="Días (texto oferta)"
            value={i.dias}
            onChange={(v) => onChange(setPath(i, 'dias', v))}
            hint="Solo descripción; no entra en el cálculo"
          />
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          Legacy: el precio base se usa como mensualidad en la oferta (anual =
          base × 12 + extra × 12). No se ha corregido la fórmula en este paso.
        </p>
      </FormSection>

      <FormSection title="Mantenimiento invernal">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldBool
            label="Incluir invernal con lona"
            value={i.incluirInvernalConLona !== false}
            onChange={(v) => onChange(setPath(i, 'incluirInvernalConLona', v))}
          />
          {i.incluirInvernalConLona !== false ? (
            <FieldNumber
              label="Precio invernal con lona (€)"
              value={i.precioConLona}
              onChange={(v) => onChange(setPath(i, 'precioConLona', v))}
            />
          ) : (
            <div />
          )}
          <FieldBool
            label="Incluir invernal sin lona"
            value={i.incluirInvernalSinLona !== false}
            onChange={(v) => onChange(setPath(i, 'incluirInvernalSinLona', v))}
          />
          {i.incluirInvernalSinLona !== false ? (
            <FieldNumber
              label="Precio invernal sin lona (€)"
              value={i.precioSinLona}
              onChange={(v) => onChange(setPath(i, 'precioSinLona', v))}
            />
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Extras (información)">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldNumber
            label="Recuperación de agua (€)"
            value={i.recuperacionAguaPrecio}
            onChange={(v) => onChange(setPath(i, 'recuperacionAguaPrecio', v))}
            hint="Informativo; no entra en los totales mensuales del motor"
          />
        </div>
      </FormSection>
    </div>
  );
}

export function MotorInputsForm({ codigoMotor, inputs, onChange, resultado }) {
  if (codigoMotor === 'precio_mensual') {
    return <PrecioMensualForm inputs={inputs} onChange={onChange} />;
  }
  if (codigoMotor === 'piscina') {
    return <PiscinaForm inputs={inputs} onChange={onChange} />;
  }
  if (codigoMotor === 'limpieza_coste') {
    return (
      <LimpiezaForm
        inputs={inputs}
        onChange={onChange}
        resultado={resultado}
      />
    );
  }
  return (
    <AuxiliaresForm
      inputs={inputs}
      onChange={onChange}
      resultado={resultado}
    />
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
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Mensual sin IVA</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {moneyEs(tot.mensualidad_sin_iva)} €
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Mensual con IVA</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {moneyEs(tot.mensualidad_con_iva)} €
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Anual sin IVA</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {moneyEs(tot.anualidad_sin_iva)} €
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-xs text-slate-500">Anual con IVA</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {moneyEs(tot.anualidad_con_iva)} €
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
