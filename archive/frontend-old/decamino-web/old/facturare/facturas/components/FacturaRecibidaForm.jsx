import { useState, useEffect } from 'react';
import { useFacturasRecibidas } from '../contexts/FacturasRecibidasContext';
import { Button, Input, Select, Card, Separator } from '../../../components/ui';
import { checkQuarterValidation, confirmOutsideQuarterOperation } from '../../../utils/quarterValidation';

// Funcție pentru a formata data din format spaniol în format numeric
const formatDateToNumeric = (dateString) => {
  if (!dateString) return '';
  
  try {
    // Dacă este deja în format numeric (DD/MM/YYYY sau YYYY-MM-DD), returnează-l
    if (dateString.includes('/') || dateString.includes('-')) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-ES'); // Returnează DD/MM/YYYY
      }
    }
    
    // Dacă este în format spaniol "29 de agosto de 2025"
    if (typeof dateString === 'string' && dateString.includes(' de ')) {
      const months = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
      };
      
      // Regex pentru a extrage ziua, luna și anul
      const match = dateString.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d+)/i);
      if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2].toLowerCase();
        const year = parseInt(match[3]);
        
        if (months[monthName] !== undefined) {
          const date = new Date(year, months[monthName] - 1, day);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('es-ES'); // Returnează DD/MM/YYYY
          }
        }
      }
    }
    
    // Dacă nu se poate parsa, returnează string-ul original
    return dateString;
    
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

const FacturaRecibidaForm = ({ factura = null, onSave, onCancel }) => {
  const { getLastFacturaRecibidaDate } = useFacturasRecibidas();
  
  const [formData, setFormData] = useState({
    numero: '',
    proveedor: '',
    cif: '',
    fecha: '',
    importe: '',
    iva: '',
    total: '',
    estado: 'pendiente',
    concepto: '',
    notas: '',
    archivo: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (factura) {
      setFormData({
        numero: factura.numero || '',
        proveedor: factura.proveedor || '',
        cif: factura.cif || '',
        fecha: formatDateToNumeric(factura.fecha) || '', // Formatează data în format numeric
        importe: factura.importe || '',
        iva: factura.iva || '',
        total: factura.total || '',
        estado: factura.estado || 'pendiente',
        concepto: factura.concepto || '',
        notas: factura.notas || '',
        archivo: factura.archivo || ''
      });
    } else {
      // Setează data de azi pentru facturi noi
      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
      setFormData(prev => ({
        ...prev,
        fecha: today
      }));
    }
  }, [factura]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.numero.trim()) {
      newErrors.numero = 'El número de factura es obligatorio';
    }

    if (!formData.proveedor.trim()) {
      newErrors.proveedor = 'El proveedor es obligatorio';
    }

    if (!formData.cif.trim()) {
      newErrors.cif = 'El CIF es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    } else {
      // Verifică dacă data nu este inferioară datei ultimei facturi primite
      const lastFacturaDate = getLastFacturaRecibidaDate();
      
      if (lastFacturaDate && !factura) {
        const selectedDate = new Date(formData.fecha);
        const lastDate = new Date(lastFacturaDate);
        
        if (selectedDate < lastDate) {
          newErrors.fecha = `La fecha no puede ser anterior a la última factura recibida (${lastDate.toLocaleDateString('es-ES')})`;
        }
      }
      
      // Verifică dacă data este în afara trimestrului curent
      const quarterValidation = checkQuarterValidation(formData.fecha);
      if (quarterValidation.isOutsideQuarter) {
        // Nu punem eroare, doar afișăm un avertisment
        console.log('⚠️ Fecha fuera del trimestre actual:', quarterValidation.message);
      }
    }

    if (!formData.importe || parseFloat(formData.importe) <= 0) {
      newErrors.importe = 'El importe debe ser mayor que 0';
    }

    if (!formData.concepto.trim()) {
      newErrors.concepto = 'El concepto es obligatorio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Verifică dacă data este în afara trimestrului curent și cere confirmarea
    const quarterValidation = checkQuarterValidation(formData.fecha);
    if (quarterValidation.isOutsideQuarter) {
      const confirmed = await confirmOutsideQuarterOperation(quarterValidation.message);
      if (!confirmed) {
        console.log('❌ Usuario canceló la operación fuera del trimestre');
        return;
      }
      console.log('✅ Usuario confirmó la operación fuera del trimestre');
    }

    try {
      const facturaData = {
        ...formData,
        importe: parseFloat(formData.importe),
        iva: parseFloat(formData.iva || 0),
        total: parseFloat(formData.total || formData.importe)
      };

      onSave(facturaData);
    } catch (error) {
      console.error('Error saving factura recibida:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Validare specială pentru data facturii
    if (field === 'fecha' && value && !factura) {
      const lastFacturaDate = getLastFacturaRecibidaDate();
      
      if (lastFacturaDate) {
        const selectedDate = new Date(value);
        const lastDate = new Date(lastFacturaDate);
        
        if (selectedDate < lastDate) {
          setErrors(prev => ({
            ...prev,
            fecha: `La fecha no puede ser anterior a la última factura recibida (${lastDate.toLocaleDateString('es-ES')})`
          }));
        }
      }
      
      // Verifică dacă data este în afara trimestrului curent
      const quarterValidation = checkQuarterValidation(value);
      if (quarterValidation.isOutsideQuarter) {
        console.log('⚠️ Fecha fuera del trimestre actual:', quarterValidation.message);
      }
    }

    // Auto-calculate total when importe or iva changes
    if (field === 'importe' || field === 'iva') {
      const importe = field === 'importe' ? value : formData.importe;
      const iva = field === 'iva' ? value : formData.iva;
      
      if (importe && iva) {
        const totalCalculado = parseFloat(importe) + parseFloat(iva);
        setFormData(prev => ({ ...prev, total: totalCalculado.toFixed(2) }));
      }
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {factura ? 'Editar Factura Recibida' : 'Nueva Factura Recibida'}
        </h2>
        <Button
          variant="outline"
          onClick={onCancel}
          className="text-gray-600"
        >
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número Factura *
            </label>
            <Input
              value={formData.numero}
              onChange={(e) => handleInputChange('numero', e.target.value)}
              placeholder="ex: FR001"
              className={errors.numero ? 'border-red-500' : ''}
            />
            {errors.numero && (
              <p className="text-red-500 text-sm mt-1">{errors.numero}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor *
            </label>
            <Input
              value={formData.proveedor}
              onChange={(e) => handleInputChange('proveedor', e.target.value)}
              placeholder="Nombre del proveedor"
              className={errors.proveedor ? 'border-red-500' : ''}
            />
            {errors.proveedor && (
              <p className="text-red-500 text-sm mt-1">{errors.proveedor}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CIF *
            </label>
            <Input
              value={formData.cif}
              onChange={(e) => handleInputChange('cif', e.target.value)}
              placeholder="B12345678"
              className={errors.cif ? 'border-red-500' : ''}
            />
            {errors.cif && (
              <p className="text-red-500 text-sm mt-1">{errors.cif}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha *
            </label>
            <Input
              type="date"
              value={formData.fecha}
              onChange={(e) => handleInputChange('fecha', e.target.value)}
              className={errors.fecha ? 'border-red-500' : ''}
            />
            {errors.fecha && (
              <p className="text-red-500 text-sm mt-1">{errors.fecha}</p>
            )}
            {!factura && !errors.fecha && (
              <p className="text-xs text-blue-600 mt-1">
                💡 La fecha debe ser igual o posterior a la última factura recibida
              </p>
            )}
            {formData.fecha && !errors.fecha && (() => {
              const quarterValidation = checkQuarterValidation(formData.fecha);
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Concepto *
          </label>
          <Input
            value={formData.concepto}
            onChange={(e) => handleInputChange('concepto', e.target.value)}
            placeholder="Descripción del servicio/producto"
            className={errors.concepto ? 'border-red-500' : ''}
          />
          {errors.concepto && (
            <p className="text-red-500 text-sm mt-1">{errors.concepto}</p>
          )}
        </div>

        <Separator />

        {/* Financial Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Importe Base *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.importe}
              onChange={(e) => handleInputChange('importe', e.target.value)}
              placeholder="0.00"
              className={errors.importe ? 'border-red-500' : ''}
            />
            {errors.importe && (
              <p className="text-red-500 text-sm mt-1">{errors.importe}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IVA
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.iva}
              onChange={(e) => handleInputChange('iva', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.total}
              onChange={(e) => handleInputChange('total', e.target.value)}
              placeholder="0.00"
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <Select
              value={formData.estado}
              onChange={(e) => handleInputChange('estado', e.target.value)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
              <option value="vencida">Vencida</option>
              <option value="anulada">Anulada</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo
            </label>
            <Input
              value={formData.archivo}
              onChange={(e) => handleInputChange('archivo', e.target.value)}
              placeholder="nombre_archivo.pdf"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas
          </label>
          <textarea
            value={formData.notas}
            onChange={(e) => handleInputChange('notas', e.target.value)}
            placeholder="Notas adicionales..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Submit Button */}
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
            className="px-6 bg-red-600 hover:bg-red-700"
          >
            {factura ? 'Actualizar' : 'Guardar'} Factura
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default FacturaRecibidaForm;
