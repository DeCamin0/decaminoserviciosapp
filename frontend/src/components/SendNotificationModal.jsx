import { useState, useEffect } from 'react';
import { X, Send, Search, User, XCircle } from 'lucide-react';

/**
 * Modal pentru trimiterea notificărilor către alți angajați
 * Doar Developer și Supervisor/Manager pot folosi acest component
 */
const SendNotificationModal = ({ isOpen, onClose, currentUser }) => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Încarcă lista de angajați
  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      // Resetează selecțiile când se deschide modalul
      setSelectedEmployees([]);
      setSearchTerm('');
      setShowEmployeeList(false);
    }
  }, [isOpen]);

  // Filtrează angajații după căutare
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = employees.filter(emp => {
        const name = (emp['NOMBRE / APELLIDOS'] || emp.nombre || '').toLowerCase();
        const email = (emp['CORREO ELECTRONICO'] || emp.email || '').toLowerCase();
        const codigo = (emp.CODIGO || emp.codigo || '').toLowerCase();
        return name.includes(term) || email.includes(term) || codigo.includes(term);
      });
      setFilteredEmployees(filtered);
    }
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || '');
      
      // Folosește endpoint-ul pentru angajați
      const response = await fetch(`${baseUrl}/api/n8n/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142`, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar empleados');
      }

      const data = await response.json();
      const employeesList = Array.isArray(data) ? data : (data?.data || data?.body?.data || []);
      
      // Filtrează utilizatorul curent
      const currentUserId = currentUser?.CODIGO || currentUser?.codigo;
      const filtered = employeesList.filter(emp => {
        const empId = emp.CODIGO || emp.codigo;
        return empId !== currentUserId;
      });

      setEmployees(filtered);
      setFilteredEmployees(filtered);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('No se pudieron cargar los empleados. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (emp) => {
    const empId = emp.CODIGO || emp.codigo;
    const isSelected = selectedEmployees.some(e => (e.CODIGO || e.codigo) === empId);
    
    if (isSelected) {
      // Deselectează
      setSelectedEmployees(prev => prev.filter(e => (e.CODIGO || e.codigo) !== empId));
    } else {
      // Selectează
      setSelectedEmployees(prev => [...prev, emp]);
    }
    
    // Închide lista după selecție
    setShowEmployeeList(false);
    setSearchTerm('');
  };

  const removeEmployee = (empId) => {
    setSelectedEmployees(prev => prev.filter(e => (e.CODIGO || e.codigo) !== empId));
  };

  const handleSend = async () => {
    if (selectedEmployees.length === 0) {
      setError('Por favor, selecciona al menos un empleado');
      return;
    }

    if (!title.trim()) {
      setError('Por favor, ingresa un título');
      return;
    }

    if (!message.trim()) {
      setError('Por favor, ingresa un mensaje');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || '');
      
      const token = localStorage.getItem('auth_token');

      // Trimite notificări către toți angajații selectați
      const promises = selectedEmployees.map(async (emp) => {
        const userId = emp.CODIGO || emp.codigo;
        const notificationData = {
          senderId: currentUser?.CODIGO || currentUser?.codigo,
          senderName: currentUser?.['NOMBRE / APELLIDOS'] || currentUser?.nombre || 'Usuario',
          recipientId: userId,
          recipientName: emp['NOMBRE / APELLIDOS'] || emp.nombre || 'Usuario',
          timestamp: new Date().toISOString(),
          source: 'manual',
        };

        const response = await fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            title: title.trim(),
            message: message.trim(),
            type: 'info',
            data: notificationData,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || `Error al enviar la notificación a ${emp['NOMBRE / APELLIDOS'] || emp.nombre}`);
        }
        return data;
      });

      await Promise.all(promises);

      setSuccess(true);
      
      // Resetează formularul după 2 secunde
      setTimeout(() => {
        setSelectedEmployees([]);
        setTitle('');
        setMessage('');
        setSearchTerm('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error sending notification:', err);
      setError(err.message || 'Error al enviar la notificación');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Enviar Notificación
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              ✅ Notificación enviada exitosamente!
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Empleados {selectedEmployees.length > 0 && `(${selectedEmployees.length} seleccionados)`}
            </label>
            
            {/* Selected Employees Chips */}
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedEmployees.map((emp) => {
                  const empId = emp.CODIGO || emp.codigo;
                  const empName = emp['NOMBRE / APELLIDOS'] || emp.nombre || 'Sin nombre';
                  return (
                    <div
                      key={empId}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      <span>{empName}</span>
                      <button
                        onClick={() => removeEmployee(empId)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        type="button"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o código..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowEmployeeList(true);
                }}
                onFocus={() => setShowEmployeeList(true)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Employee List */}
            {showEmployeeList && (
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Cargando empleados...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron empleados' : 'No hay empleados disponibles'}
                  </div>
                ) : (
                  filteredEmployees
                    .filter(emp => {
                      // Exclude deja selectați
                      const empId = emp.CODIGO || emp.codigo;
                      return !selectedEmployees.some(sel => (sel.CODIGO || sel.codigo) === empId);
                    })
                    .map((emp) => {
                      const empId = emp.CODIGO || emp.codigo;
                      const empName = emp['NOMBRE / APELLIDOS'] || emp.nombre || 'Sin nombre';
                      const empEmail = emp['CORREO ELECTRONICO'] || emp.email || '';

                      return (
                        <button
                          key={empId}
                          onClick={() => toggleEmployee(emp)}
                          className="w-full text-left p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{empName}</p>
                              <p className="text-sm text-gray-500">{empEmail}</p>
                              <p className="text-xs text-gray-400">Código: {empId}</p>
                            </div>
                            <div className="text-gray-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Nueva tarea asignada"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje de la notificación..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedEmployees.length === 0 || !title.trim() || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Notificación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendNotificationModal;
