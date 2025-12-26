import { useState } from 'react';
import { useGastos } from '../contexts/GastosContext';
import { checkQuarterValidation, confirmOutsideQuarterOperation } from '../../../utils/quarterValidation';

const initialForm = {
  magazin: '',
  adresa: '',
  telefon: '',
  cif: '',
  tip_bon: '',
  numar_operatiune: '',
  data: '',
  ora: '',
  produse_text: '',
  baza_impozabila: '',
  tva: '',
  cota_tva: '',
  total_platit: '',
  moneda: 'EUR',
  metoda_plata: '',
  rest: '',
  imputable: true
};

const GastoManualModal = ({ isOpen, onClose, onSaved }) => {
  const { createManualGasto } = useGastos();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      // Verifică dacă data este în afara trimestrului curent și cere confirmarea
      const quarterValidation = checkQuarterValidation(form.data);
      if (quarterValidation.isOutsideQuarter) {
        const confirmed = await confirmOutsideQuarterOperation(quarterValidation.message);
        if (!confirmed) {
          console.log('❌ Usuario canceló la operación fuera del trimestre');
          return;
        }
        console.log('✅ Usuario confirmó la operación fuera del trimestre');
      }

      setSaving(true);
      const payload = { ...form };
      const res = await createManualGasto(payload);
      if (res?.success) {
        setForm(initialForm);
        onSaved && onSaved(res.item);
        onClose && onClose();
      } else {
        alert(res?.error || 'No se pudo guardar el gasto');
      }
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = 'text', placeholder }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={form[name]}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      {/* Indicator pentru trimestrul în afara perioadei curente */}
      {name === 'data' && form[name] && (() => {
        const quarterValidation = checkQuarterValidation(form[name]);
        if (quarterValidation.isOutsideQuarter) {
          return (
            <p className="text-xs text-orange-600 mt-1">
              ⚠️ {quarterValidation.message}
            </p>
          );
        }
        return null;
      })()}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[95vw] max-w-4xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Cargar Gasto Manual</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-auto pr-1">
          <Field label="Tienda" name="magazin" placeholder="CASTELUL" />
          <Field label="Dirección" name="adresa" placeholder="Dirección completa" />
          <Field label="Teléfono" name="telefon" placeholder="911 000 000" />
          <Field label="CIF" name="cif" placeholder="X1234567Z" />
          <Field label="Tipo Bon" name="tip_bon" placeholder="Factura Simplificada" />
          <Field label="Número Operación" name="numar_operatiune" placeholder="T-000000" />
          <Field label="Fecha" name="data" type="date" />
          <Field label="Hora" name="ora" type="time" />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Productos</label>
            <textarea
              name="produse_text"
              value={form.produse_text}
              onChange={handleChange}
              placeholder="1 x Producto @ 10 = 10 | 2 x Otro @ 5 = 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          </div>
          <Field label="Base Imponible" name="baza_impozabila" type="number" placeholder="0.00" />
          <Field label="IVA" name="tva" type="number" placeholder="0.00" />
          <Field label="Tipo IVA (%)" name="cota_tva" type="number" placeholder="21" />
          <Field label="Total Pagado" name="total_platit" type="number" placeholder="0.00" />
          <Field label="Moneda" name="moneda" placeholder="EUR" />
          <Field label="Método de Pago" name="metoda_plata" placeholder="Efectivo/Tarjeta" />
          <Field label="Cambio" name="rest" type="number" placeholder="0.00" />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Imputable</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="imputable"
                  value="true"
                  checked={form.imputable === true}
                  onChange={(e) => setForm(prev => ({ ...prev, imputable: e.target.value === 'true' }))}
                  className="mr-2 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">Sí</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="imputable"
                  value="false"
                  checked={form.imputable === false}
                  onChange={(e) => setForm(prev => ({ ...prev, imputable: e.target.value === 'true' }))}
                  className="mr-2 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">No</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar Gasto'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GastoManualModal;


