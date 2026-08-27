import { Gift } from 'lucide-react';
import { Modal, Button, AlertBanner } from '../ui';
import { formatHofScore } from './hallOfFameUi.utils';

export function HallOfFameBreakdownModal({
  isOpen,
  breakdown,
  selectedEmployee,
  onClose,
}) {
  if (!isOpen || !breakdown) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Breakdown — ${breakdown.empleadoNombre || selectedEmployee}`}
      size="lg"
      className="app-modal--form hof-breakdown-modal"
    >
      <div className="hof-breakdown-modal__grid">
        <div>
          <p className="hof-breakdown-modal__label">Puntuación final</p>
          <p className="hof-breakdown-modal__value hof-breakdown-modal__value--primary">
            {formatHofScore(breakdown.score_final)}
          </p>
        </div>
        <div>
          <p className="hof-breakdown-modal__label">Ranking</p>
          <p className="hof-breakdown-modal__value">#{breakdown.ranking || '—'}</p>
        </div>
      </div>

      <div className="hof-breakdown-modal__section">
        <h3 className="hof-breakdown-modal__section-title">Detalles KPI</h3>
        <ul className="hof-breakdown-modal__list">
          <li><strong>Cumplimiento horas (30%):</strong> {formatHofScore(breakdown.score_indeplinire)}</li>
          <li><strong>Calidad fichaje (20%):</strong> {formatHofScore(breakdown.score_calitate)}</li>
          <li><strong>Puntualidad (10%):</strong> {formatHofScore(breakdown.score_punctualitate)}</li>
          <li><strong>Uso de la aplicación (10%):</strong> {formatHofScore(breakdown.score_uso_app)}</li>
          <li><strong>Responsabilidad digital (30%):</strong> {formatHofScore(breakdown.score_responsabilidad_digital)}</li>
        </ul>
      </div>

      {breakdown.breakdown_json ? (
        <div className="hof-breakdown-modal__section">
          <h3 className="hof-breakdown-modal__section-title">Desglose JSON</h3>
          <pre className="hof-breakdown-modal__json">
            {JSON.stringify(breakdown.breakdown_json, null, 2)}
          </pre>
        </div>
      ) : null}
    </Modal>
  );
}

export function HallOfFamePremioModal({
  isOpen,
  employee,
  premioFecha,
  loading,
  onClose,
  onChangeFecha,
  onConfirm,
}) {
  if (!isOpen || !employee) return null;

  const name = employee.empleadoNombre || employee.NOMBRE || employee.empleado_codigo || employee.CODIGO;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dar premio"
      size="md"
      className="app-modal--form hof-premio-modal"
      footer={(
        <div className="hof-premio-modal__footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={loading || !premioFecha}
            onClick={onConfirm}
          >
            <Gift className="w-4 h-4" aria-hidden />
            Confirmar premio
          </Button>
        </div>
      )}
    >
      <div className="hof-premio-modal__field">
        <span className="hof-premio-modal__label">Empleado</span>
        <p className="hof-premio-modal__employee">{name}</p>
      </div>
      <label className="hof-premio-modal__field" htmlFor="hof-premio-fecha">
        <span className="hof-premio-modal__label">Fecha del día libre</span>
        <input
          id="hof-premio-fecha"
          type="date"
          value={premioFecha}
          onChange={(e) => onChangeFecha(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="hof-input"
        />
      </label>
      <AlertBanner variant="info" title="Información">
        Se otorgará un día de permiso retribuido como premio por desempeño en el Salón de la Fama.
      </AlertBanner>
    </Modal>
  );
}
