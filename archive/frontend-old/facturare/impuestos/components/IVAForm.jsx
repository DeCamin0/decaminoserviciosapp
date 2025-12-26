import { useState, useEffect } from 'react';
import { Button, Input, Select, Card, Separator } from '../../../components/ui';

const IVAForm = ({ iva = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    model: '303',
    period: '',
    year: new Date().getFullYear(),
    status: 'pendiente',
    fechaPresentacion: '',
    fechaVencimiento: '',
    baseImponible: '',
    ivaRepercutido: '',
    ivaSoportado: '',
    resultado: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (iva) {
      setFormData({
        model: iva.model || '303',
        period: iva.period || '',
        year: iva.year || new Date().getFullYear(),
        status: iva.status || 'pendiente',
        fechaPresentacion: iva.fechaPresentacion || '',
        fechaVencimiento: iva.fechaVencimiento || '',
        baseImponible: iva.baseImponible || '',
        ivaRepercutido: iva.ivaRepercutido || '',
        ivaSoportado: iva.ivaSoportado || '',
        resultado: iva.resultado || '',
        notes: iva.notes || ''
      });
    } else {
      // Set default values for new IVA declaration
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
      setFormData(prev => ({
        ...prev,
        year: currentYear,
        period: `Q${currentQuarter} ${currentYear}`,
        fechaVencimiento: getDefaultDueDate(currentYear, currentQuarter)
      }));
    }
  }, [iva]);

  const getDefaultDueDate = (year, quarter) => {
    const dueDates = {
      1: `${year}-04-20`, // Q1: April 20
      2: `${year}-07-20`, // Q2: July 20
      3: `${year}-10-20`, // Q3: October 20
      4: `${year}-01-30`  // Q4: January 30 (next year)
    };
    return dueDates[quarter] || `${year}-04-20`;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.model) {
      newErrors.model = 'El modelo es obligatorio';
    }

    if (!formData.period.trim()) {
      newErrors.period = 'El período es obligatorio';
    }

    if (!formData.year) {
      newErrors.year = 'El año es obligatorio';
    }

    if (!formData.fechaVencimiento) {
      newErrors.fechaVencimiento = 'La fecha de vencimiento es obligatoria';
    }

    if (!formData.baseImponible || parseFloat(formData.baseImponible) < 0) {
      newErrors.baseImponible = 'La base imponible debe ser mayor o igual a 0';
    }

    if (!formData.ivaRepercutido || parseFloat(formData.ivaRepercutido) < 0) {
      newErrors.ivaRepercutido = 'El IVA repercutido debe ser mayor o igual a 0';
    }

    if (!formData.ivaSoportado || parseFloat(formData.ivaSoportado) < 0) {
      newErrors.ivaSoportado = 'El IVA soportado debe ser mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const ivaData = {
        ...formData,
        year: parseInt(formData.year),
        baseImponible: parseFloat(formData.baseImponible || 0),
        ivaRepercutido: parseFloat(formData.ivaRepercutido || 0),
        ivaSoportado: parseFloat(formData.ivaSoportado || 0),
        resultado: parseFloat(formData.resultado || 0)
      };

      onSave(ivaData);
    } catch (error) {
      console.error('Error saving IVA declaration:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Auto-calculate resultado when financial fields change
    if (['baseImponible', 'ivaRepercutido', 'ivaSoportado'].includes(field)) {
      const baseImponible = field === 'baseImponible' ? value : formData.baseImponible;
      const ivaRepercutido = field === 'ivaRepercutido' ? value : formData.ivaRepercutido;
      const ivaSoportado = field === 'ivaSoportado' ? value : formData.ivaSoportado;
      
      if (baseImponible && ivaRepercutido && ivaSoportado) {
        const resultado = parseFloat(ivaRepercutido) - parseFloat(ivaSoportado);
        setFormData(prev => ({ ...prev, resultado: resultado.toFixed(2) }));
      }
    }

    // Auto-update period when year or quarter changes
    if (field === 'year' || field === 'quarter') {
      const quarter = field === 'quarter' ? value : formData.quarter;
      const year = field === 'year' ? value : formData.year;
      if (quarter && year) {
        setFormData(prev => ({ ...prev, period: `Q${quarter} ${year}` }));
      }
    }
  };

  const handleQuarterChange = (quarter) => {
    setFormData(prev => ({
      ...prev,
      quarter: quarter,
      period: `Q${quarter} ${prev.year}`,
      fechaVencimiento: getDefaultDueDate(prev.year, quarter)
    }));
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modelo *
            </label>
            <Select
              value={formData.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              className={errors.model ? 'border-red-500' : ''}
            >
              <option value="303">303 - Trimestral</option>
              <option value="390">390 - Anual</option>
            </Select>
            {errors.model && (
              <p className="text-red-500 text-sm mt-1">{errors.model}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trimestre
            </label>
            <Select
              value={formData.quarter || '1'}
              onChange={(e) => handleQuarterChange(e.target.value)}
            >
              <option value="1">Q1 - Enero a Marzo</option>
              <option value="2">Q2 - Abril a Junio</option>
              <option value="3">Q3 - Julio a Septiembre</option>
              <option value="4">Q4 - Octubre a Diciembre</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Año *
            </label>
            <Select
              value={formData.year}
              onChange={(e) => handleInputChange('year', e.target.value)}
              className={errors.year ? 'border-red-500' : ''}
            >
              {[2024, 2023, 2022, 2021, 2020].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>
            {errors.year && (
              <p className="text-red-500 text-sm mt-1">{errors.year}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período *
            </label>
            <Input
              value={formData.period}
              onChange={(e) => handleInputChange('period', e.target.value)}
              placeholder="Q1 2024"
              className={errors.period ? 'border-red-500' : ''}
            />
            {errors.period && (
              <p className="text-red-500 text-sm mt-1">{errors.period}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <Select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="presentado">Presentado</option>
              <option value="vencido">Vencido</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Presentación
            </label>
            <Input
              type="date"
              value={formData.fechaPresentacion}
              onChange={(e) => handleInputChange('fechaPresentacion', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Vencimiento *
            </label>
            <Input
              type="date"
              value={formData.fechaVencimiento}
              onChange={(e) => handleInputChange('fechaVencimiento', e.target.value)}
              className={errors.fechaVencimiento ? 'border-red-500' : ''}
            />
            {errors.fechaVencimiento && (
              <p className="text-red-500 text-sm mt-1">{errors.fechaVencimiento}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Financial Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información Financiera</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Imponible *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.baseImponible}
                onChange={(e) => handleInputChange('baseImponible', e.target.value)}
                placeholder="0.00"
                className={errors.baseImponible ? 'border-red-500' : ''}
              />
              {errors.baseImponible && (
                <p className="text-red-500 text-sm mt-1">{errors.baseImponible}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IVA Repercutido *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.ivaRepercutido}
                onChange={(e) => handleInputChange('ivaRepercutido', e.target.value)}
                placeholder="0.00"
                className={errors.ivaRepercutido ? 'border-red-500' : ''}
              />
              {errors.ivaRepercutido && (
                <p className="text-red-500 text-sm mt-1">{errors.ivaRepercutido}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IVA Soportado *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.ivaSoportado}
                onChange={(e) => handleInputChange('ivaSoportado', e.target.value)}
                placeholder="0.00"
                className={errors.ivaSoportado ? 'border-red-500' : ''}
              />
              {errors.ivaSoportado && (
                <p className="text-red-500 text-sm mt-1">{errors.ivaSoportado}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resultado (Calculado automáticamente)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.resultado}
              onChange={(e) => handleInputChange('resultado', e.target.value)}
              placeholder="0.00"
              readOnly
              className="bg-gray-50 font-semibold"
            />
            <p className="text-xs text-gray-500 mt-1">
              IVA Repercutido - IVA Soportado
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Notas adicionales sobre la declaración..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="px-6"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="px-6 bg-purple-600 hover:bg-purple-700"
          >
            {iva ? 'Actualizar' : 'Guardar'} Declaración
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default IVAForm;
