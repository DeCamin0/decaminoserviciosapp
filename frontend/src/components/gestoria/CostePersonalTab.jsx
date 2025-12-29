import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '../../utils/routes';

const MESES = [
  { value: 'ENERO', label: 'Enero' },
  { value: 'FEBRERO', label: 'Febrero' },
  { value: 'MARZO', label: 'Marzo' },
  { value: 'ABRIL', label: 'Abril' },
  { value: 'MAYO', label: 'Mayo' },
  { value: 'JUNIO', label: 'Junio' },
  { value: 'JULIO', label: 'Julio' },
  { value: 'AGOSTO', label: 'Agosto' },
  { value: 'SEPTIEMBRE', label: 'Septiembre' },
  { value: 'OCTUBRE', label: 'Octubre' },
  { value: 'NOVIEMBRE', label: 'Noviembre' },
  { value: 'DICIEMBRE', label: 'Diciembre' },
];

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

// Funcție helper pentru a obține luna curentă
const getCurrentMonth = () => {
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return monthNames[currentMonth];
};

export default function CostePersonalTab() {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState([]);
  const [selectedMes, setSelectedMes] = useState(getCurrentMonth());
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [poblando, setPoblando] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Preview states
  const [excelPreviewData, setExcelPreviewData] = useState(null);
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false);
  const [nominasPreviewData, setNominasPreviewData] = useState(null);
  const [showNominasPreviewModal, setShowNominasPreviewModal] = useState(false);
  const [pdfsPreviewData, setPdfsPreviewData] = useState(null);
  const [showPdfsPreviewModal, setShowPdfsPreviewModal] = useState(false);
  const [uploadingPdfs, setUploadingPdfs] = useState(false);
  
  // States pentru combobox angajați în preview
  const [empleadosList, setEmpleadosList] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [comboboxState, setComboboxState] = useState({
    show: false,
    searchTerm: '',
    selectedIndex: -1,
    rowKey: null, // Identifică rândul curent (sheetIdx-idx)
  });

  // Încărcăm datele când se schimbă luna sau anul
  useEffect(() => {
    loadData();
  }, [selectedMes, selectedAno]);

  // Încărcăm lista de angajați când se deschide preview Excel
  useEffect(() => {
    if (showExcelPreviewModal) {
      console.log('📋 Modal opened, empleadosList length:', empleadosList.length);
      if (empleadosList.length === 0) {
        console.log('📋 Loading empleados list...');
        loadEmpleadosList();
      }
    }
  }, [showExcelPreviewModal]);


  const loadEmpleadosList = async () => {
    setLoadingEmpleados(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getEmpleados, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📋 Empleados response:', result);
        // Endpoint-ul returnează direct array-ul, nu { data: ... }
        const empleados = Array.isArray(result) ? result : (result.data || result.empleados || []);
        console.log('📋 Total empleados loaded:', empleados.length);
        if (empleados.length > 0) {
          console.log('📋 First empleado sample:', empleados[0]);
        }
        setEmpleadosList(empleados);
      } else {
        console.error('❌ Error loading empleados:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (err) {
      console.error('❌ Error loading empleados:', err);
    } finally {
      setLoadingEmpleados(false);
    }
  };

  const handleSelectEmpleado = (sheetIdx, rowIdx, empleado) => {
    const newExcelData = { ...excelPreviewData };
    const nombreCompleto = empleado['NOMBRE / APELLIDOS'] || '';
    const codigo = empleado.CODIGO || '';
    
    // Actualizăm datele în preview
    newExcelData.sheets[sheetIdx].data[rowIdx].codigo = codigo;
    newExcelData.sheets[sheetIdx].data[rowIdx].nombre_bd = nombreCompleto;
    newExcelData.sheets[sheetIdx].data[rowIdx].empleado_encontrado = true;
    newExcelData.sheets[sheetIdx].data[rowIdx].confianza = 100; // 100% pentru selecție manuală
    
    setExcelPreviewData(newExcelData);
    setEditingCell(null);
    setComboboxState({ show: false, searchTerm: '', selectedIndex: -1, rowKey: null });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.getCostePersonal(selectedMes, selectedAno), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cargar datos');
      }

      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Solo se permiten archivos Excel (.xlsx, .xls)');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setExcelPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(routes.uploadCostePersonal, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar Excel');
      }

      const result = await response.json();
      
      // Afișăm preview înainte de salvare
      if (result.sheets && result.sheets.length > 0) {
        setExcelPreviewData(result);
        setShowExcelPreviewModal(true);
      } else {
        setError('No se encontraron datos en el Excel');
      }
    } catch (err) {
      setError(err.message || 'Error al procesar Excel');
      console.error('Error uploading Coste Personal:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmExcelSave = async () => {
    if (!excelPreviewData || !excelPreviewData.sheets || excelPreviewData.sheets.length === 0) {
      setError('No hay datos para guardar');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const firstSheet = excelPreviewData.sheets[0];
      
      // Actualizăm selecția pentru a încărca datele
      setSelectedMes(firstSheet.mes);
      setSelectedAno(firstSheet.ano);
      
      // Salvăm datele în baza de date
      const saveResponse = await fetch(routes.saveCostePersonalFromExcel, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: firstSheet.mes,
          ano: firstSheet.ano,
          data: firstSheet.data,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Error al guardar datos');
      }

      const saveResult = await saveResponse.json();
      setSuccess(true);
      setShowExcelPreviewModal(false);
      setExcelPreviewData(null);
      
      // Recărcăm datele pentru a le afișa
      await loadData();
    } catch (saveErr) {
      setError(`Error al guardar: ${saveErr.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFromExcel = async (excelData) => {
    if (!excelData || !excelData.sheets || excelData.sheets.length === 0) {
      setError('No hay datos para guardar');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const firstSheet = excelData.sheets[0];
      
      const response = await fetch(routes.saveCostePersonalFromExcel, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: firstSheet.mes,
          ano: firstSheet.ano,
          data: firstSheet.data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar datos');
      }

      const result = await response.json();
      setSuccess(true);
      // Recărcăm datele
      await loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar datos');
    } finally {
      setSaving(false);
    }
  };

  const handleCellEdit = async (rowId, field, newValue) => {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Pentru câmpuri numerice, convertim la număr
      // Pentru câmpuri string (codigo_empleado, nombre_empleado, nombre_bd), folosim direct
      const numericFields = ['total', 'neto', 'aportaciones_trabajador', 'irpf', 'enfermedad_devolucion', 'embargos', 'anticipo', 'absentismo_laboral', 'seg_social_empresa'];
      const value = numericFields.includes(field) 
        ? parseFloat(newValue.replace(',', '.')) || 0
        : newValue.trim();
      
      // Găsim rândul pentru a verifica dacă este VACACIONES
      const row = data.find(r => r.id === rowId);
      const isVacaciones = row && row.codigo_empleado === 'VACACIONES';
      
      // Dacă este VACACIONES și se editează "total", actualizăm și "total_calculado" cu aceeași valoare
      if (isVacaciones && field === 'total') {
        // Actualizăm ambele câmpuri: total și total_calculado
        const response1 = await fetch(routes.updateCostePersonalField(rowId), {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field: 'total',
            value,
          }),
        });
        
        if (!response1.ok) {
          const errorData = await response1.json();
          throw new Error(errorData.message || 'Error al actualizar');
        }
        
        // Actualizăm și total_calculado cu aceeași valoare
        const response2 = await fetch(routes.updateCostePersonalField(rowId), {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field: 'total_calculado',
            value,
          }),
        });
        
        if (!response2.ok) {
          const errorData = await response2.json();
          throw new Error(errorData.message || 'Error al actualizar total_calculado');
        }
      } else {
        // Pentru celelalte cazuri, actualizăm doar câmpul specificat
        const response = await fetch(routes.updateCostePersonalField(rowId), {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field,
            value,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al actualizar');
        }
      }

      // Recărcăm datele pentru a obține valorile actualizate (inclusiv nombre_bd dacă s-a actualizat codigo)
      await loadData();
    } catch (err) {
      setError(err.message || 'Error al actualizar');
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const handlePDFCellEdit = (rowIdx, field, newValue) => {
    if (!pdfsPreviewData || !pdfsPreviewData.preview) return;
    
    const updatedPreview = [...pdfsPreviewData.preview];
    const numericFields = ['total_calculado', 'neto', 'aportaciones_trabajador', 'irpf', 'enfermedad_devolucion', 'embargos', 'anticipo', 'absentismo_laboral', 'seg_social_empresa', 'total_aportaciones'];
    
    if (numericFields.includes(field)) {
      // Pentru câmpuri numerice, convertim la număr
      // total_calculado nu se editează direct, se recalculează automat
      if (field !== 'total_calculado') {
        updatedPreview[rowIdx][field] = parseFloat(newValue.replace(',', '.')) || 0;
      }
      
      // Recalculăm total_calculado dacă s-a modificat un câmp numeric (exceptând total_calculado)
      if (field !== 'total_calculado') {
        const row = updatedPreview[rowIdx];
        row.total_calculado = 
          (row.neto || 0) +
          (row.aportaciones_trabajador || 0) +
          (row.irpf || 0) -
          (row.enfermedad_devolucion || 0) +
          (row.embargos || 0) +
          (row.anticipo || 0) +
          (row.seg_social_empresa || 0);
        
        // Recalculăm total_aportaciones
        row.total_aportaciones = 
          (row.aportaciones_trabajador || 0) +
          (row.seg_social_empresa || 0);
      }
    } else {
      // Pentru câmpuri string
      updatedPreview[rowIdx][field] = newValue.trim();
    }
    
    setPdfsPreviewData({ ...pdfsPreviewData, preview: updatedPreview });
    setEditingCell(null);
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number') return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyInput = (value) => {
    if (typeof value !== 'number') return '';
    return value.toFixed(2).replace('.', ',');
  };

  const handlePoblarDesdeNominas = async () => {
    setPoblando(true);
    setError(null);
    setSuccess(false);
    setNominasPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.poblarCostePersonalDesdeNominas, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: selectedMes,
          ano: selectedAno,
          preview: true, // Preview mode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al poblar datos');
      }

      const result = await response.json();
      
      // Afișăm preview înainte de salvare
      if (result.preview && result.preview.length > 0) {
        setNominasPreviewData(result);
        setShowNominasPreviewModal(true);
      } else {
        setError('No se encontraron datos para poblar');
      }
    } catch (err) {
      setError(err.message || 'Error al poblar datos desde nóminas');
    } finally {
      setPoblando(false);
    }
  };

  const handlePDFsUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Verificăm că toate sunt PDF-uri
    const invalidFiles = files.filter(file => !file.name.endsWith('.pdf') && file.type !== 'application/pdf');
    if (invalidFiles.length > 0) {
      setError('Solo se permiten archivos PDF');
      return;
    }

    setUploadingPdfs(true);
    setError(null);
    setSuccess(false);
    setPdfsPreviewData(null);

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('mes', selectedMes);
      formData.append('ano', selectedAno.toString());

      const response = await fetch(routes.uploadPDFsParaCostePersonal, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar PDFs');
      }

      const result = await response.json();
      
      // Afișăm preview înainte de salvare
      if (result.preview && result.preview.length > 0) {
        setPdfsPreviewData(result);
        setShowPdfsPreviewModal(true);
      } else {
        setError('No se encontraron datos en los PDFs');
      }
    } catch (err) {
      setError(err.message || 'Error al procesar PDFs');
      console.error('Error uploading PDFs:', err);
    } finally {
      setUploadingPdfs(false);
      // Resetăm input-ul pentru a permite re-upload
      event.target.value = '';
    }
  };

  const handleConfirmPDFsSave = async () => {
    if (!pdfsPreviewData || !pdfsPreviewData.preview || pdfsPreviewData.preview.length === 0) {
      setError('No hay datos para guardar');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      // Folosim mes/ano detectat din PDF-uri sau fallback la selectat
      const mesToUse = pdfsPreviewData.mes_detectado || selectedMes;
      const anoToUse = pdfsPreviewData.ano_detectado || selectedAno;
      
      const response = await fetch(routes.saveCostePersonalFromPreview, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: mesToUse,
          ano: anoToUse,
          preview: pdfsPreviewData.preview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar datos');
      }

      const result = await response.json();
      setSuccess(true);
      setShowPdfsPreviewModal(false);
      setPdfsPreviewData(null);
      
      // Recărcăm datele
      await loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar datos desde PDFs');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmNominasSave = async () => {
    if (!nominasPreviewData) {
      setError('No hay datos para guardar');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.poblarCostePersonalDesdeNominas, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: selectedMes,
          ano: selectedAno,
          preview: false, // Save mode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar datos');
      }

      const result = await response.json();
      setSuccess(true);
      setShowNominasPreviewModal(false);
      setNominasPreviewData(null);
      
      // Recărcăm datele
      await loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar datos desde nóminas');
    } finally {
      setSaving(false);
    }
  };

  const handleLimpiarMes = async () => {
    const mesNombre = MESES.find(m => m.value === selectedMes)?.label || selectedMes;
    const confirmar = window.confirm(
      `¿Estás seguro de que quieres eliminar TODOS los registros de Coste Personal para ${mesNombre} ${selectedAno}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(routes.limpiarCostePersonalMes, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mes: selectedMes,
          ano: selectedAno,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al limpiar datos');
      }

      const result = await response.json();
      setSuccess(true);
      
      // Recărcăm datele
      await loadData();
      
      // Mesaj de succes
      alert(`✅ Se eliminaron ${result.deleted || 0} registros de ${mesNombre} ${selectedAno}`);
    } catch (err) {
      setError(err.message || 'Error al limpiar datos');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportCostePersonalExcel(selectedMes, selectedAno);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Coste_Personal_${selectedMes}_${selectedAno}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al exportar Excel');
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = routes.exportCostePersonalPDF(selectedMes, selectedAno);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Coste_Personal_${selectedMes}_${selectedAno}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al exportar PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
        <h2 className="text-xl font-bold text-gray-900">💰 Coste Personal</h2>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona los costes de personal por mes y año. Puedes editar directamente las celdas.
        </p>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Mes
            </label>
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MESES.map((mes) => (
                <option key={mes.value} value={mes.value}>
                  {mes.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📆 Año
            </label>
            <select
              value={selectedAno}
              onChange={(e) => setSelectedAno(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ANOS.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buton Limpiar Mes */}
        <div className="mb-4">
          <button
            onClick={handleLimpiarMes}
            disabled={deleting || loading || data.length === 0}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>Limpiar Mes ({MESES.find(m => m.value === selectedMes)?.label} {selectedAno})</span>
              </>
            )}
          </button>
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Esta acción eliminará TODOS los registros de Coste Personal para el mes y año seleccionados. Esta acción no se puede deshacer.
          </p>
        </div>

        {/* Butoane de export */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📥 Exportar Datos
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleExportExcel}
              disabled={loading || data.length === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>📊</span>
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={loading || data.length === 0}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>📄</span>
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📄 Cargar desde Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📋 Poblar desde Nóminas (BD)
            </label>
            <button
              onClick={handlePoblarDesdeNominas}
              disabled={poblando || loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {poblando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Poblando...</span>
                </>
              ) : (
                <>
                  <span>💰</span>
                  <span>Poblar desde Nóminas</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Extrae datos de las nóminas subidas para {MESES.find(m => m.value === selectedMes)?.label} {selectedAno}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📄 Cargar PDFs para Coste Personal (no se guardan como nóminas)
          </label>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handlePDFsUpload}
            disabled={uploadingPdfs}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Puedes subir uno o varios PDFs. Cada página será procesada como una nómina para extraer datos de Coste Personal. Los PDFs NO se guardarán en la base de datos.
          </p>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-indigo-600 mt-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span>Procesando Excel...</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-indigo-600 mt-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span>Cargando datos...</span>
          </div>
        )}

        {saving && (
          <div className="flex items-center gap-2 text-indigo-600 mt-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span>Guardando...</span>
          </div>
        )}

        {poblando && (
          <div className="flex items-center gap-2 text-indigo-600 mt-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span>Poblando desde nóminas...</span>
          </div>
        )}

        {uploadingPdfs && (
          <div className="flex items-center gap-2 text-indigo-600 mt-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            <span>Procesando PDFs...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mt-4">
            ✅ Operación realizada correctamente
          </div>
        )}
      </div>

      {/* Table - Always visible, even if empty */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <h3 className="text-lg font-bold">
              {MESES.find(m => m.value === selectedMes)?.label} {selectedAno} - {data.length} empleados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                    Operario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Nombre BD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Total (Excel)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Total (Calculat)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Neto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Aport. Trab.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    IRPF
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Enf. Dev.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Embargos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Anticipo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Absentismo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Seg. Social Emp.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Total Aportaciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.length > 0 ? (
                  <>
                    {data.map((row) => {
                      // Detectăm potriviri nesigure: există codigo dar empleado_encontrado = false sau confianza < 100
                      const tieneCodigoPeroNoEncontrado = row.codigo_empleado && !row.codigo_empleado.startsWith('TEMP_') && !row.empleado_encontrado;
                      const confianzaBaja = row.confianza !== undefined && row.confianza < 100 && row.confianza >= 80;
                      const esPotrivireNesigura = tieneCodigoPeroNoEncontrado || confianzaBaja;
                      
                      return (
                      <tr 
                        key={row.id} 
                        className={`hover:bg-gray-50 ${
                          !row.empleado_encontrado && !row.codigo_empleado?.startsWith('TEMP_') 
                            ? 'bg-yellow-50' 
                            : esPotrivireNesigura 
                              ? 'bg-orange-50' 
                              : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                          {row.nombre_empleado}
                        </td>
                        {/* Código - editabil */}
                        <td 
                          className="px-4 py-3 text-sm text-left text-gray-700 cursor-pointer hover:bg-indigo-50"
                          onClick={() => setEditingCell(`${row.id}-codigo_empleado`)}
                          onDoubleClick={() => setEditingCell(`${row.id}-codigo_empleado`)}
                        >
                          {editingCell === `${row.id}-codigo_empleado` ? (
                            <input
                              type="text"
                              defaultValue={row.codigo_empleado}
                              onBlur={(e) => {
                                handleCellEdit(row.id, 'codigo_empleado', e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellEdit(row.id, 'codigo_empleado', e.target.value);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="w-full text-left border-2 border-indigo-500 rounded px-2 py-1"
                            />
                          ) : (
                            <span className={row.codigo_empleado?.startsWith('TEMP_') ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                              {row.codigo_empleado}
                            </span>
                          )}
                        </td>
                        {/* Estado - indicator vizual */}
                        <td className="px-4 py-3 text-sm text-center">
                          {row.empleado_encontrado ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              ✅ Encontrado
                            </span>
                          ) : esPotrivireNesigura ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800" title={`Confianza: ${row.confianza || 0}%`}>
                              ⚠️ Coincidencia incierta {row.confianza ? `(${row.confianza}%)` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                              ⚠️ No encontrado
                            </span>
                          )}
                        </td>
                        {/* Nombre BD - editabil */}
                        <td 
                          className="px-4 py-3 text-sm text-left text-gray-600 cursor-pointer hover:bg-indigo-50"
                          onClick={() => setEditingCell(`${row.id}-nombre_bd`)}
                          onDoubleClick={() => setEditingCell(`${row.id}-nombre_bd`)}
                        >
                          {editingCell === `${row.id}-nombre_bd` ? (
                            <input
                              type="text"
                              defaultValue={row.nombre_bd || ''}
                              onBlur={(e) => {
                                handleCellEdit(row.id, 'nombre_bd', e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellEdit(row.id, 'nombre_bd', e.target.value);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="w-full text-left border-2 border-indigo-500 rounded px-2 py-1"
                              placeholder="Introduce nombre completo..."
                            />
                          ) : (
                            row.nombre_bd ? (
                              <span className="text-gray-700">{row.nombre_bd}</span>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )
                          )}
                        </td>
                        {/* Total (Excel) - editabil doar pentru VACACIONES */}
                        <td 
                          className={`px-4 py-3 text-sm text-right ${
                            row.codigo_empleado === 'VACACIONES' 
                              ? 'cursor-pointer hover:bg-indigo-50 text-gray-700' 
                              : 'text-gray-700'
                          }`}
                          onClick={() => {
                            if (row.codigo_empleado === 'VACACIONES') {
                              setEditingCell(`total-${row.id}`);
                            }
                          }}
                        >
                          {editingCell === `total-${row.id}` && row.codigo_empleado === 'VACACIONES' ? (
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={row.total || 0}
                              onBlur={(e) => handleCellEdit(row.id, 'total', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellEdit(row.id, 'total', e.target.value);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border border-indigo-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            formatCurrency(row.total || 0)
                          )}
                        </td>
                        {/* Total (Calculat) */}
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          Math.abs((row.total || 0) - (row.total_calculado || 0)) > 0.01
                            ? 'text-red-600 bg-red-50'
                            : 'text-green-600'
                        }`}>
                          {formatCurrency(row.total_calculado || 0)}
                          {Math.abs((row.total || 0) - (row.total_calculado || 0)) > 0.01 && (
                            <span className="ml-1 text-xs" title={`Diferencia: ${formatCurrency(Math.abs((row.total || 0) - (row.total_calculado || 0)))}`}>
                              ⚠️
                            </span>
                          )}
                        </td>
                        {['neto', 'aportaciones_trabajador', 'irpf', 'enfermedad_devolucion', 'embargos', 'anticipo', 'absentismo_laboral', 'seg_social_empresa'].map((field) => (
                          <td
                            key={field}
                            className="px-4 py-3 text-sm text-right text-gray-700 cursor-pointer hover:bg-indigo-50"
                            onClick={() => setEditingCell(`${row.id}-${field}`)}
                            onDoubleClick={() => setEditingCell(`${row.id}-${field}`)}
                          >
                            {editingCell === `${row.id}-${field}` ? (
                              <input
                                type="text"
                                defaultValue={formatCurrencyInput(row[field])}
                                onBlur={(e) => {
                                  handleCellEdit(row.id, field, e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellEdit(row.id, field, e.target.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="w-full text-right border-2 border-indigo-500 rounded px-2 py-1"
                              />
                            ) : (
                              formatCurrency(row[field])
                            )}
                          </td>
                        ))}
                        {/* Total Aportaciones */}
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {formatCurrency((row.total_aportaciones || 0))}
                        </td>
                      </tr>
                    );
                    })}
                    {/* Totals Row - Calculat ca suma dintre CON AURA și VACACIONES */}
                    {(() => {
                      const conAuraRow = data.find(row => row.codigo_empleado === 'CON_AURA');
                      const vacacionesRow = data.find(row => row.codigo_empleado === 'VACACIONES');
                      
                      const totalRow = {
                        total: (conAuraRow?.total || 0) + (vacacionesRow?.total || 0),
                        total_calculado: (conAuraRow?.total_calculado || 0) + (vacacionesRow?.total_calculado || 0),
                        neto: (conAuraRow?.neto || 0) + (vacacionesRow?.neto || 0),
                        aportaciones_trabajador: (conAuraRow?.aportaciones_trabajador || 0) + (vacacionesRow?.aportaciones_trabajador || 0),
                        irpf: (conAuraRow?.irpf || 0) + (vacacionesRow?.irpf || 0),
                        enfermedad_devolucion: (conAuraRow?.enfermedad_devolucion || 0) + (vacacionesRow?.enfermedad_devolucion || 0),
                        embargos: (conAuraRow?.embargos || 0) + (vacacionesRow?.embargos || 0),
                        anticipo: (conAuraRow?.anticipo || 0) + (vacacionesRow?.anticipo || 0),
                        absentismo_laboral: (conAuraRow?.absentismo_laboral || 0) + (vacacionesRow?.absentismo_laboral || 0),
                        seg_social_empresa: (conAuraRow?.seg_social_empresa || 0) + (vacacionesRow?.seg_social_empresa || 0),
                        total_aportaciones: (conAuraRow?.total_aportaciones || 0) + (vacacionesRow?.total_aportaciones || 0),
                      };
                      
                      return (
                        <tr className="bg-indigo-50 font-bold">
                          <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-indigo-50 z-10" colSpan="4">
                            TOTAL
                          </td>
                          {/* Total (Excel) */}
                          <td className="px-4 py-3 text-sm text-right text-indigo-900">
                            {formatCurrency(totalRow.total)}
                          </td>
                          {/* Total (Calculat) */}
                          <td className="px-4 py-3 text-sm text-right text-indigo-900">
                            {formatCurrency(totalRow.total_calculado)}
                          </td>
                          {['neto', 'aportaciones_trabajador', 'irpf', 'enfermedad_devolucion', 'embargos', 'anticipo', 'absentismo_laboral', 'seg_social_empresa'].map((field) => (
                            <td key={field} className="px-4 py-3 text-sm text-right text-indigo-900">
                              {formatCurrency(totalRow[field] || 0)}
                            </td>
                          ))}
                          {/* Total Aportaciones */}
                          <td className="px-4 py-3 text-sm text-right text-indigo-900">
                            {formatCurrency(totalRow.total_aportaciones)}
                          </td>
                        </tr>
                      );
                    })()}
                  </>
                ) : (
                  <tr>
                    <td colSpan="15" className="px-4 py-8 text-center text-gray-500">
                      <p className="text-sm">No hay datos para {MESES.find(m => m.value === selectedMes)?.label} {selectedAno}</p>
                      <p className="text-xs text-gray-400 mt-2">Sube un archivo Excel o edita manualmente los datos</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Preview Excel */}
      {showExcelPreviewModal && excelPreviewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExcelPreviewModal(false);
              setExcelPreviewData(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de Excel - Coste Personal
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los datos antes de confirmar la subida
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowExcelPreviewModal(false);
                    setExcelPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {excelPreviewData.sheets && excelPreviewData.sheets.length > 0 ? (
                excelPreviewData.sheets.map((sheet, sheetIdx) => (
                  <div key={sheetIdx} className="mb-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">
                      📊 {sheet.name} - {sheet.mes} {sheet.ano}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Operario</th>
                            <th className="px-3 py-2 text-left">Código</th>
                            <th className="px-3 py-2 text-center">Estado</th>
                            <th className="px-3 py-2 text-left">Nombre BD</th>
                            <th className="px-3 py-2 text-right">Total (Excel)</th>
                            <th className="px-3 py-2 text-right">Total (Calculat)</th>
                            <th className="px-3 py-2 text-right">Neto</th>
                            <th className="px-3 py-2 text-right">Aport. Trab.</th>
                            <th className="px-3 py-2 text-right">IRPF</th>
                            <th className="px-3 py-2 text-right">Enf. Dev.</th>
                            <th className="px-3 py-2 text-right">Embargos</th>
                            <th className="px-3 py-2 text-right">Anticipo</th>
                            <th className="px-3 py-2 text-right">Absentismo</th>
                            <th className="px-3 py-2 text-right">Seg. Social Emp.</th>
                            <th className="px-3 py-2 text-right">Total Aportaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.data.map((row, idx) => {
                            const tieneCodigoPeroNoEncontrado = row.codigo && !row.codigo.startsWith('TEMP_') && !row.empleado_encontrado;
                            const confianzaBaja = row.confianza !== undefined && row.confianza < 100 && row.confianza >= 80;
                            const esPotrivireNesigura = tieneCodigoPeroNoEncontrado || confianzaBaja;
                            
                            return (
                            <tr 
                              key={idx} 
                              className={`border-b border-gray-100 ${
                                !row.empleado_encontrado && !row.codigo?.startsWith('TEMP_') 
                                  ? 'bg-yellow-50' 
                                  : esPotrivireNesigura 
                                    ? 'bg-orange-50' 
                                    : ''
                              }`}
                            >
                              <td className="px-3 py-2 font-medium">{row.operario}</td>
                              <td className="px-3 py-2">
                                {row.codigo ? (
                                  <span className={row.codigo.startsWith('TEMP_') ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                                    {row.codigo}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.empleado_encontrado ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                    ✅
                                  </span>
                                ) : esPotrivireNesigura ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800" title={`Confianza: ${row.confianza || 0}%`}>
                                    ⚠️ {row.confianza ? `${row.confianza}%` : ''}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                    ⚠️
                                  </span>
                                )}
                              </td>
                              {/* Nombre BD - combobox cu căutare */}
                              <td 
                                className="px-3 py-2 text-left text-gray-600 relative"
                                style={{ position: 'relative' }}
                              >
                                {editingCell === `preview-excel-${sheetIdx}-${idx}-nombre_bd` ? (
                                  <div className="relative w-full combobox-container">
                                    <input
                                      type="text"
                                      value={comboboxState.rowKey === `preview-excel-${sheetIdx}-${idx}` ? comboboxState.searchTerm : (row.nombre_bd || '')}
                                      onChange={(e) => {
                                        setComboboxState({
                                          show: true,
                                          searchTerm: e.target.value,
                                          selectedIndex: -1,
                                          rowKey: `preview-excel-${sheetIdx}-${idx}`,
                                        });
                                      }}
                                      onFocus={() => {
                                        setComboboxState({
                                          show: true,
                                          searchTerm: row.nombre_bd || '',
                                          selectedIndex: -1,
                                          rowKey: `preview-excel-${sheetIdx}-${idx}`,
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        const filteredEmpleados = empleadosList.filter(emp => {
                                          const nombre = (emp['NOMBRE / APELLIDOS'] || '').toUpperCase();
                                          const search = comboboxState.searchTerm.toUpperCase();
                                          return nombre.includes(search);
                                        });

                                        if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          setComboboxState(prev => ({
                                            ...prev,
                                            selectedIndex: prev.selectedIndex < filteredEmpleados.length - 1 
                                              ? prev.selectedIndex + 1 
                                              : prev.selectedIndex,
                                          }));
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          setComboboxState(prev => ({
                                            ...prev,
                                            selectedIndex: prev.selectedIndex > 0 
                                              ? prev.selectedIndex - 1 
                                              : -1,
                                          }));
                                        } else if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (comboboxState.selectedIndex >= 0 && comboboxState.selectedIndex < filteredEmpleados.length) {
                                            const selected = filteredEmpleados[comboboxState.selectedIndex];
                                            handleSelectEmpleado(sheetIdx, idx, selected);
                                          } else if (filteredEmpleados.length === 1) {
                                            handleSelectEmpleado(sheetIdx, idx, filteredEmpleados[0]);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null);
                                          setComboboxState({ show: false, searchTerm: '', selectedIndex: -1, rowKey: null });
                                        }
                                      }}
                                      onBlur={(e) => {
                                        // Delay pentru a permite click pe item
                                        setTimeout(() => {
                                          if (!e.currentTarget.contains(document.activeElement)) {
                                            setEditingCell(null);
                                            setComboboxState({ show: false, searchTerm: '', selectedIndex: -1, rowKey: null });
                                          }
                                        }, 200);
                                      }}
                                      autoFocus
                                      className="w-full text-left border-2 border-indigo-500 rounded px-2 py-1"
                                      placeholder="Buscar empleado..."
                                    />
                                    {comboboxState.show && comboboxState.rowKey === `preview-excel-${sheetIdx}-${idx}` && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg flex flex-col">
                                        {/* Lista scrollabilă */}
                                        <div className="max-h-60 overflow-y-auto">
                                          {loadingEmpleados ? (
                                            <div className="p-3 text-center text-gray-500 text-sm">Cargando empleados...</div>
                                          ) : (() => {
                                            const filtered = empleadosList.filter(emp => {
                                              const nombre = (emp['NOMBRE / APELLIDOS'] || emp.nombre || '').toUpperCase();
                                              const search = comboboxState.searchTerm.toUpperCase();
                                              return nombre.includes(search);
                                            });
                                            
                                            console.log('🔍 Filtered empleados:', filtered.length, 'from', empleadosList.length, 'search:', comboboxState.searchTerm);
                                            
                                            if (filtered.length === 0) {
                                              return (
                                                <div className="p-3 text-center text-gray-500 text-sm">
                                                  {comboboxState.searchTerm ? 'No se encontraron empleados' : 'Escribe para buscar...'}
                                                </div>
                                              );
                                            }
                                            
                                            return (
                                              <>
                                                {filtered.slice(0, 50).map((emp, empIdx) => {
                                                  const nombre = emp['NOMBRE / APELLIDOS'] || emp.nombre || '';
                                                  const codigo = emp.CODIGO || emp.codigo || '';
                                                  return (
                                                    <div
                                                      key={codigo || empIdx}
                                                      onClick={() => {
                                                        setComboboxState(prev => ({
                                                          ...prev,
                                                          selectedIndex: empIdx,
                                                          searchTerm: nombre,
                                                        }));
                                                      }}
                                                      className={`p-2 cursor-pointer hover:bg-indigo-50 ${
                                                        comboboxState.selectedIndex === empIdx ? 'bg-indigo-100 border-l-2 border-indigo-500' : ''
                                                      }`}
                                                    >
                                                      <div className="font-medium text-sm text-gray-900">{nombre}</div>
                                                      <div className="text-xs text-gray-500">Código: {codigo}</div>
                                                    </div>
                                                  );
                                                })}
                                              </>
                                            );
                                          })()}
                                        </div>
                                        {/* Butoane de acțiune în footer - fixate */}
                                        <div className="border-t border-gray-200 p-2 flex gap-2 justify-end bg-gray-50 flex-shrink-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingCell(null);
                                              setComboboxState({ show: false, searchTerm: '', selectedIndex: -1, rowKey: null });
                                            }}
                                            className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded flex items-center gap-1.5 transition-colors"
                                            title="Cancelar"
                                          >
                                            <span className="text-red-500">✕</span>
                                            <span>Cancelar</span>
                                          </button>
                                          {(() => {
                                            const filtered = empleadosList.filter(emp => {
                                              const nombre = (emp['NOMBRE / APELLIDOS'] || emp.nombre || '').toUpperCase();
                                              const search = comboboxState.searchTerm.toUpperCase();
                                              return nombre.includes(search);
                                            });
                                            const hasSelection = comboboxState.selectedIndex >= 0 && comboboxState.selectedIndex < filtered.length;
                                            const hasSingleResult = filtered.length === 1 && comboboxState.searchTerm.trim().length > 0;
                                            
                                            if (hasSelection || hasSingleResult) {
                                              return (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (hasSelection) {
                                                      handleSelectEmpleado(sheetIdx, idx, filtered[comboboxState.selectedIndex]);
                                                    } else if (hasSingleResult) {
                                                      handleSelectEmpleado(sheetIdx, idx, filtered[0]);
                                                    }
                                                  }}
                                                  className="px-3 py-1.5 text-sm font-medium bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-1.5 transition-colors shadow-sm"
                                                  title="Confirmar selección"
                                                >
                                                  <span className="text-lg">✓</span>
                                                  <span>Confirmar</span>
                                                </button>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span 
                                    className="text-gray-700 cursor-pointer hover:bg-indigo-50 px-1 py-0.5 rounded"
                                    onClick={() => {
                                      console.log('🔍 Opening combobox, empleadosList:', empleadosList.length);
                                      if (empleadosList.length === 0) {
                                        loadEmpleadosList();
                                      }
                                      setEditingCell(`preview-excel-${sheetIdx}-${idx}-nombre_bd`);
                                      setComboboxState({
                                        show: true,
                                        searchTerm: row.nombre_bd || '',
                                        selectedIndex: -1,
                                        rowKey: `preview-excel-${sheetIdx}-${idx}`,
                                      });
                                    }}
                                  >
                                    {row.nombre_bd || <span className="text-gray-400 italic">-</span>}
                                  </span>
                                )}
                              </td>
                              {/* Total (Excel) */}
                              <td className="px-3 py-2 text-right">{formatCurrency(row.total || 0)}</td>
                              {/* Total (Calculat) */}
                              <td className={`px-3 py-2 text-right font-medium ${
                                Math.abs((row.total || 0) - (row.total_calculado || 0)) > 0.01
                                  ? 'text-red-600 bg-red-50'
                                  : 'text-green-600'
                              }`}>
                                {formatCurrency(row.total_calculado || 0)}
                                {Math.abs((row.total || 0) - (row.total_calculado || 0)) > 0.01 && (
                                  <span className="ml-1 text-xs" title={`Diferencia: ${formatCurrency(Math.abs((row.total || 0) - (row.total_calculado || 0)))}`}>
                                    ⚠️
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.neto)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.aportaciones_trabajador)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.irpf)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.enfermedad_devolucion)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.embargos)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.anticipo)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.absentismo_laboral)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.seg_social_empresa)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.total_aportaciones || 0)}</td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Total: {sheet.data.length} empleados
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No hay datos para mostrar</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExcelPreviewModal(false);
                  setExcelPreviewData(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmExcelSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : '✅ Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Preview Nóminas */}
      {showNominasPreviewModal && nominasPreviewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNominasPreviewModal(false);
              setNominasPreviewData(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de Nóminas - Coste Personal
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los datos extraídos de las nóminas antes de confirmar
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {MESES.find(m => m.value === selectedMes)?.label} {selectedAno} - {nominasPreviewData.processed || 0} procesadas, {nominasPreviewData.errors || 0} errores
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowNominasPreviewModal(false);
                    setNominasPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {nominasPreviewData.preview && nominasPreviewData.preview.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Nombre</th>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Neto</th>
                        <th className="px-3 py-2 text-right">Aport. Trab.</th>
                        <th className="px-3 py-2 text-right">IRPF</th>
                        <th className="px-3 py-2 text-right">Enf. Dev.</th>
                        <th className="px-3 py-2 text-right">Embargos</th>
                        <th className="px-3 py-2 text-right">Anticipo</th>
                        <th className="px-3 py-2 text-right">Absentismo</th>
                        <th className="px-3 py-2 text-right">Seg. Social Emp.</th>
                        <th className="px-3 py-2 text-right">Total Aportaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominasPreviewData.preview.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={`border-b border-gray-100 ${!row.empleado_encontrado ? 'bg-yellow-50' : ''} ${row.error ? 'bg-red-50' : ''}`}
                        >
                          <td className="px-3 py-2 text-center">
                            {row.es_finiquito ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                🔴 Finiquito
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                📄 Nómina
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{row.nombre}</td>
                          <td className="px-3 py-2">
                            {row.codigo ? (
                              <span className={row.codigo.startsWith('TEMP_') ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                                {row.codigo}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.empleado_encontrado ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                ✅
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                ⚠️
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.total)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.neto)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.aportaciones_trabajador)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.irpf)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.enfermedad_devolucion)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.embargos)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.anticipo)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.absentismo_laboral)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.seg_social_empresa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No hay datos para mostrar</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNominasPreviewModal(false);
                  setNominasPreviewData(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmNominasSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : '✅ Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Preview PDFs */}
      {showPdfsPreviewModal && pdfsPreviewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPdfsPreviewModal(false);
              setPdfsPreviewData(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    📋 Verificación de PDFs - Coste Personal
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Revisa los datos extraídos de los PDFs antes de confirmar
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {pdfsPreviewData.mes_detectado 
                      ? `${pdfsPreviewData.mes_detectado} ${pdfsPreviewData.ano_detectado || selectedAno} (detectado desde PDFs)`
                      : `${MESES.find(m => m.value === selectedMes)?.label} ${selectedAno} (seleccionado manualmente)`
                    } - {pdfsPreviewData.processed || 0} procesadas, {pdfsPreviewData.errors || 0} errores
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPdfsPreviewModal(false);
                    setPdfsPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {pdfsPreviewData.preview && pdfsPreviewData.preview.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Archivo</th>
                        <th className="px-3 py-2 text-left">Página</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Nombre PDF</th>
                        <th className="px-3 py-2 text-left">Nombre BD</th>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-right">Total (Calculat)</th>
                        <th className="px-3 py-2 text-right">Neto</th>
                        <th className="px-3 py-2 text-right">Aport. Trab.</th>
                        <th className="px-3 py-2 text-right">IRPF</th>
                        <th className="px-3 py-2 text-right">Enf. Dev.</th>
                        <th className="px-3 py-2 text-right">Embargos</th>
                        <th className="px-3 py-2 text-right">Anticipo</th>
                        <th className="px-3 py-2 text-right">Absentismo</th>
                        <th className="px-3 py-2 text-right">Seg. Social Emp.</th>
                        <th className="px-3 py-2 text-right">Total Aportaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfsPreviewData.preview.map((row, idx) => {
                        // Detectăm potriviri nesigure: există codigo dar empleado_encontrado = false sau confianza < 100
                        const tieneCodigoPeroNoEncontrado = row.codigo && !row.codigo.startsWith('NO_ENC_') && !row.empleado_encontrado;
                        const confianzaBaja = row.confianza !== undefined && row.confianza < 100 && row.confianza >= 80;
                        const esPotrivireNesigura = tieneCodigoPeroNoEncontrado || confianzaBaja;
                        
                        return (
                        <tr 
                          key={idx} 
                          className={`border-b border-gray-100 ${
                            row.error 
                              ? 'bg-red-50' 
                              : !row.empleado_encontrado && !row.codigo?.startsWith('NO_ENC_')
                                ? 'bg-yellow-50'
                                : esPotrivireNesigura
                                  ? 'bg-orange-50'
                                  : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {row.nombre_archivo ? (
                              <span className="font-mono" title={row.nombre_archivo}>
                                {row.nombre_archivo.length > 20 
                                  ? row.nombre_archivo.substring(0, 20) + '...' 
                                  : row.nombre_archivo}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2">{row.pagina || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            {row.es_finiquito ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                🔴 Finiquito
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                📄 Nómina
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.nombre}</td>
                          {/* Nombre BD - editabil */}
                          <td 
                            className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                            onClick={() => setEditingCell(`pdf-nombre_bd-${idx}`)}
                          >
                            {editingCell === `pdf-nombre_bd-${idx}` ? (
                              <input
                                type="text"
                                defaultValue={row.nombre_bd || ''}
                                onBlur={(e) => handlePDFCellEdit(idx, 'nombre_bd', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handlePDFCellEdit(idx, 'nombre_bd', e.target.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="w-full px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              row.nombre_bd ? (
                                <span className="text-indigo-700 font-medium">{row.nombre_bd}</span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )
                            )}
                          </td>
                          {/* Código - editabil */}
                          <td 
                            className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                            onClick={() => setEditingCell(`pdf-codigo-${idx}`)}
                          >
                            {editingCell === `pdf-codigo-${idx}` ? (
                              <input
                                type="text"
                                defaultValue={row.codigo || ''}
                                onBlur={(e) => handlePDFCellEdit(idx, 'codigo', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handlePDFCellEdit(idx, 'codigo', e.target.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="w-full px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              row.codigo ? (
                                <span className={row.codigo.startsWith('NO_ENC_') ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                                  {row.codigo}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.empleado_encontrado ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                ✅
                              </span>
                            ) : esPotrivireNesigura ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800" title={`Confianza: ${row.confianza || 0}%`}>
                                ⚠️ Coincidencia incierta {row.confianza ? `(${row.confianza}%)` : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                ⚠️
                              </span>
                            )}
                          </td>
                          {/* Total (Calculat) - read-only, calculat automat */}
                          <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                            {formatCurrency(row.total_calculado || 0)}
                          </td>
                          {/* Coloane numerice editabile */}
                          {['neto', 'aportaciones_trabajador', 'irpf', 'enfermedad_devolucion', 'embargos', 'anticipo', 'absentismo_laboral', 'seg_social_empresa', 'total_aportaciones'].map((field) => (
                            <td 
                              key={field}
                              className="px-3 py-2 text-right cursor-pointer hover:bg-indigo-50"
                              onClick={() => setEditingCell(`pdf-${field}-${idx}`)}
                            >
                              {editingCell === `pdf-${field}-${idx}` ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={row[field] || 0}
                                  onBlur={(e) => handlePDFCellEdit(idx, field, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePDFCellEdit(idx, field, e.target.value);
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-1 border border-indigo-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                formatCurrency(row[field] || 0)
                              )}
                            </td>
                          ))}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No hay datos para mostrar</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPdfsPreviewModal(false);
                  setPdfsPreviewData(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPDFsSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : '✅ Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
