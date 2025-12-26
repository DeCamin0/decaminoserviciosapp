import { useEffect, useState } from 'react';
import { Button, Input } from '../../components/ui';

export default function ClienteForm({ cliente = null, onSubmit, onCancel, tipo = 'cliente' }) {
  // Lista de țări pentru dropdown
  const paises = [
    'España', 'Francia', 'Italia', 'Portugal', 'Alemania', 'Reino Unido', 'Irlanda', 'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Suecia', 'Noruega', 'Dinamarca', 'Finlandia',
    'Polonia', 'República Checa', 'Eslovaquia', 'Hungría', 'Rumania', 'Bulgaria', 'Croacia', 'Eslovenia', 'Estonia', 'Letonia', 'Lituania', 'Grecia', 'Chipre', 'Malta', 'Luxemburgo',
    'Marruecos', 'Argelia', 'Túnez', 'Egipto', 'Libia', 'Sudán', 'Etiopía', 'Kenia', 'Nigeria', 'Sudáfrica', 'Marruecos', 'Senegal', 'Ghana', 'Costa de Marfil', 'Mali',
    'Estados Unidos', 'Canadá', 'México', 'Brasil', 'Argentina', 'Chile', 'Colombia', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Cuba', 'República Dominicana',
    'China', 'Japón', 'Corea del Sur', 'India', 'Tailandia', 'Vietnam', 'Filipinas', 'Indonesia', 'Malasia', 'Singapur', 'Taiwán', 'Hong Kong', 'Australia', 'Nueva Zelanda', 'Rusia',
    'Turquía', 'Israel', 'Emiratos Árabes Unidos', 'Arabia Saudí', 'Irán', 'Iraq', 'Afganistán', 'Pakistán', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bután', 'Myanmar', 'Laos', 'Camboya',
    'Otros'
  ].sort();

  const [formData, setFormData] = useState({
    tipo: cliente?.tipo || tipo,
    nombre: cliente?.nombre || '',
    nif: cliente?.nif || '',
    telefono: cliente?.telefono || '',
    movil: cliente?.movil || '',
    fax: cliente?.fax || '',
    email: cliente?.email || '',
    direccion: cliente?.direccion || '',
    cp: cliente?.cp || '',
    ciudad: cliente?.ciudad || '',
    provincia: cliente?.provincia || '',
    pais: cliente?.pais || 'España',
    url: cliente?.url || '',
    descuento_por_defecto: cliente?.descuento_por_defecto || '',
    limite_gasto: cliente?.limite_gasto || '',
    latitud: cliente?.latitud || '',
    longitud: cliente?.longitud || '',
    contacto_nombre: cliente?.contacto_nombre || '',
    contacto_telefono: cliente?.contacto_telefono || '',
    tipo_servicio: cliente?.tipo_servicio || '',
    notas: cliente?.notas || '',
    cuentas_bancarias: cliente?.cuentas_bancarias || '',
    fecha_ultima_renovacion: cliente?.fecha_ultima_renovacion || '',
    fecha_proxima_renovacion: cliente?.fecha_proxima_renovacion || '',
    activo: cliente?.activo || 'Sí'
  });

  // Sincronizează formularul când se deschide în modul editare
  useEffect(() => {
    if (cliente) {
      setFormData({
        tipo: cliente.tipo ?? tipo,
        nombre: cliente.nombre ?? '',
        nif: cliente.nif ?? '',
        telefono: cliente.telefono ?? '',
        movil: cliente.movil ?? '',
        fax: cliente.fax ?? '',
        email: cliente.email ?? '',
        direccion: cliente.direccion ?? '',
        cp: cliente.cp ?? '',
        ciudad: cliente.ciudad ?? '',
        provincia: cliente.provincia ?? '',
        pais: cliente.pais ?? 'España',
        url: cliente.url ?? '',
        descuento_por_defecto: cliente.descuento_por_defecto ?? '',
        limite_gasto: cliente.limite_gasto ?? '',
        latitud: cliente.latitud ?? '',
        longitud: cliente.longitud ?? '',
        contacto_nombre: cliente.contacto_nombre ?? '',
        contacto_telefono: cliente.contacto_telefono ?? '',
        tipo_servicio: cliente.tipo_servicio ?? '',
        notas: cliente.notas ?? '',
        cuentas_bancarias: cliente.cuentas_bancarias ?? '',
        fecha_ultima_renovacion: cliente.fecha_ultima_renovacion ?? '',
        fecha_proxima_renovacion: cliente.fecha_proxima_renovacion ?? '',
        activo: cliente.activo ?? 'Sí'
      });
    }
  }, [cliente, tipo]);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    // Validar solo si hay valores presentes (permitir parcial)
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    if (formData.telefono && !/^[\d\s\-+()]+$/.test(formData.telefono)) {
      newErrors.telefono = 'Teléfono inválido';
    }
    if (formData.movil && !/^[\d\s\-+()]+$/.test(formData.movil)) {
      newErrors.movil = 'Móvil inválido';
    }
    if (formData.fax && !/^[\d\s\-+()]+$/.test(formData.fax)) {
      newErrors.fax = 'Fax inválido';
    }
    if (formData.descuento_por_defecto && isNaN(Number(String(formData.descuento_por_defecto).replace(',', '.')))) {
      newErrors.descuento_por_defecto = 'Descuento inválido';
    }
    if (formData.latitud && isNaN(Number(String(formData.latitud).replace(',', '.')))) {
      newErrors.latitud = 'Latitud inválida';
    }
    if (formData.longitud && isNaN(Number(String(formData.longitud).replace(',', '.')))) {
      newErrors.longitud = 'Longitud inválida';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    try {
      await onSubmit({
        ...formData
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información básica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo
          </label>
          <select
            value={formData.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-100"
            disabled={true}
          >
            <option value="cliente">Cliente</option>
            <option value="proveedor">Proveedor</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Tipo determinado automáticamente</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NOMBRE O RAZON SOCIAL
          </label>
          <Input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleChange('nombre', e.target.value)}
            placeholder="Nombre cliente/empresa"
            error={errors.nombre}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NIF/CIF
          </label>
          <Input
            type="text"
            value={formData.nif}
            onChange={(e) => handleChange('nif', e.target.value)}
            placeholder="NIF o CIF"
            error={errors.nif}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de servicio
          </label>
          <select
            value={formData.tipo_servicio}
            onChange={(e) => handleChange('tipo_servicio', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Selecciona tipo</option>
            <option value="Comunidad de propietarios">Comunidad de propietarios</option>
            <option value="Empresa">Empresa</option>
            <option value="Persona física">Persona física</option>
            <option value="Administración">Administración</option>
            <option value="Otros">Otros</option>
          </select>
        </div>
      </div>

      {/* Contacto */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información de contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono
            </label>
            <Input
              type="tel"
              value={formData.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              placeholder="+34 600 000 000"
              error={errors.telefono}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Móvil
            </label>
            <Input
              type="tel"
              value={formData.movil}
              onChange={(e) => handleChange('movil', e.target.value)}
              placeholder="+34 600 000 000"
              error={errors.movil}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="client@example.com"
              error={errors.email}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fax
            </label>
            <Input
              type="text"
              value={formData.fax}
              onChange={(e) => handleChange('fax', e.target.value)}
              placeholder="+34 91 000 0000"
              error={errors.fax}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Persona de contacto
            </label>
            <Input
              type="text"
              value={formData.contacto_nombre}
              onChange={(e) => handleChange('contacto_nombre', e.target.value)}
              placeholder="Nume persoană de contact"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono de contacto
            </label>
            <Input
              type="tel"
              value={formData.contacto_telefono}
              onChange={(e) => handleChange('contacto_telefono', e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>
        </div>
      </div>

      {/* Dirección */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dirección</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección completa
            </label>
            <Input
              type="text"
              value={formData.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              placeholder="Calle, Número, Piso, Puerta"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código postal
            </label>
            <Input
              type="text"
              value={formData.cp}
              onChange={(e) => handleChange('cp', e.target.value)}
              placeholder="28001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ciudad
            </label>
            <Input
              type="text"
              value={formData.ciudad}
              onChange={(e) => handleChange('ciudad', e.target.value)}
              placeholder="Madrid"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provincia
            </label>
            <Input
              type="text"
              value={formData.provincia}
              onChange={(e) => handleChange('provincia', e.target.value)}
              placeholder="Madrid"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              País
            </label>
            <select
              value={formData.pais}
              onChange={(e) => handleChange('pais', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Selecciona país...</option>
              {paises.map(pais => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
            <Input
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="www.ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">DESCUENTO POR DEFECTO (%)</label>
            <Input
              type="text"
              value={formData.descuento_por_defecto}
              onChange={(e) => handleChange('descuento_por_defecto', e.target.value)}
              placeholder="0.00"
              error={errors.descuento_por_defecto}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LATITUD</label>
            <Input
              type="text"
              value={formData.latitud}
              onChange={(e) => handleChange('latitud', e.target.value)}
              placeholder="40.4168"
              error={errors.latitud}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LONGITUD</label>
            <Input
              type="text"
              value={formData.longitud}
              onChange={(e) => handleChange('longitud', e.target.value)}
              placeholder="-3.7038"
              error={errors.longitud}
            />
          </div>
        </div>
      </div>

      {/* Otra información */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Otra información</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={formData.activo}
              onChange={(e) => handleChange('activo', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="Sí">Activo</option>
              <option value="No">Inactivo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Ultima Renovacion</label>
            <Input
              type="date"
              value={formData.fecha_ultima_renovacion}
              onChange={(e) => handleChange('fecha_ultima_renovacion', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Proxima Renovacion</label>
            <Input
              type="date"
              value={formData.fecha_proxima_renovacion}
              onChange={(e) => handleChange('fecha_proxima_renovacion', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Límite de gasto (EUR)</label>
            <Input
              type="number"
              step="0.01"
              value={formData.limite_gasto}
              onChange={(e) => handleChange('limite_gasto', e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NOTAS PRIVADAS
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => handleChange('notas', e.target.value)}
              rows={4}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Notas privadas del cliente..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">CUENTAS BANCARIAS</label>
            <textarea
              value={formData.cuentas_bancarias}
              onChange={(e) => handleChange('cuentas_bancarias', e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="IBAN; Banco; Observaciones..."
            />
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {submitting ? 'Guardando...' : (cliente ? 'Actualizar' : 'Añadir')}
        </Button>
      </div>
    </form>
  );
} 