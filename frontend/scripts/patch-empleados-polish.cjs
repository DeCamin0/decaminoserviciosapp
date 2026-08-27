const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/EmpleadosPage.jsx');
let s = fs.readFileSync(filePath, 'utf8');

// Form labels — add form
s = s.replace(
  /<label htmlFor=\{fieldId\} className="block text-sm font-medium text-gray-700 mb-2">\s*\{field === 'CODIGO' && '🆔'\}[\s\S]*?\{field\}\s*<\/label>/,
  '<label htmlFor={fieldId} className="app-modal__label block mb-2">{getEmployeeFieldLabel(field)}</label>',
);

// Form labels — edit modal (multiline ternary block)
s = s.replace(
  /<label htmlFor=\{fieldId\} className="block text-sm font-medium text-gray-700 mb-2">[\s\S]*?field\}\s*<\/label>/,
  '<label htmlFor={fieldId} className="app-modal__label block mb-2">{getEmployeeFieldLabel(field)}</label>',
  1,
);

// Estadísticas row actions
s = s.replace(
  `                            <button
                              onClick={() => handleCrearSolicitudInspeccion(emp)}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
                              title="Crear solicitud de inspección"
                            >
                              🔍 Solicitar Inspección
                            </button>`,
  `                            <button
                              type="button"
                              onClick={() => handleCrearSolicitudInspeccion(emp)}
                              className="solicitud-admin-btn text-xs"
                              title="Crear solicitud de inspección"
                            >
                              <ClipboardList className="w-4 h-4" aria-hidden />
                              <span>Solicitar inspección</span>
                            </button>`,
);

s = s.replace(
  `                              <button
                                onClick={() => handleCrearTarea(emp)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-xs font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
                                title="Crear solicitud de tarea"
                              >
                                ✅ Crear tarea
                              </button>`,
  `                              <button
                                type="button"
                                onClick={() => handleCrearTarea(emp)}
                                className="solicitud-admin-btn text-xs"
                                title="Crear solicitud de tarea"
                              >
                                <CheckSquare className="w-4 h-4" aria-hidden />
                                <span>Crear tarea</span>
                              </button>`,
);

// Estadísticas export toolbar
s = s.replace(
  `                <div className="mt-4 flex gap-3 justify-end">
                  <button
                    onClick={handleExportEstadisticasExcel}
                    disabled={loadingEstadisticas || estadisticas.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    onClick={handleExportEstadisticasPDF}
                    disabled={loadingEstadisticas || estadisticas.length === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>📄</span>
                    <span>Exportar PDF</span>
                  </button>
                </div>`,
  `                <div className="solicitud-admin-toolbar documentos-actions flex-wrap justify-end mt-4">
                  <button type="button" onClick={handleExportEstadisticasExcel} disabled={loadingEstadisticas || estadisticas.length === 0} className="solicitud-admin-btn">
                    <FileSpreadsheet className="w-4 h-4" aria-hidden /><span>Exportar Excel</span>
                  </button>
                  <button type="button" onClick={handleExportEstadisticasPDF} disabled={loadingEstadisticas || estadisticas.length === 0} className="solicitud-admin-btn">
                    <FileText className="w-4 h-4" aria-hidden /><span>Exportar PDF</span>
                  </button>
                </div>`,
);

// Edit modal overlay — mobile header always visible
s = s.replace(
  'className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10500]"',
  'className="fixed inset-0 bg-black/60 backdrop-blur-sm flex empleados-edit-overlay justify-center z-[10500]"',
);

// Modal form class + hide default close where custom footers exist
const modalTags = [
  'showEmailModal',
  'showWelcomeEmailModal',
  'showSolicitarDocumentoModal',
  'showSolicitarDocumentoTodosModal',
  'showDespidoModal',
  'showIbanModal',
  'emailListConfirm',
];
for (const tag of modalTags) {
  const re = new RegExp(`(<Modal\\s+[^>]*isOpen=\\{[^}]*${tag}[^}]*\\}[^>]*)>`, 'g');
  s = s.replace(re, (m) => {
    let out = m;
    if (!out.includes('showCloseButton={false}')) out = out.replace('>', ' showCloseButton={false}>');
    if (!out.includes('className=')) out = out.replace('>', ' className="app-modal--form">');
    else if (!out.includes('app-modal--form')) out = out.replace(/className="([^"]*)"/, 'className="$1 app-modal--form"');
    return out;
  });
}

// Email modal — use title, strip legacy hero
s = s.replace(
  `      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title=""
        size="xl"
      >
        <div className="max-w-2xl mx-auto">
          {/* Header moderno */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">📧</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enviar Email</h2>
            <p className="text-gray-600">Comunicación profesional con el equipo</p>
          </div>

          {/* Información empleado seleccionado - Diseño moderno */}
          {selectedUserForEmail && emailForm.destinatar === 'angajat' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">
                    {selectedUserForEmail['NOMBRE / APELLIDOS']?.charAt(0) || 'A'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedUserForEmail['NOMBRE / APELLIDOS']}
                  </h3>
                  <p className="text-blue-600 font-medium">
                    Código: {selectedUserForEmail.CODIGO}
                  </p>
                </div>
              </div>
            </div>
          )}`,
  `      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Enviar email"
        size="xl"
        showCloseButton={false}
        className="app-modal--form"
      >
        <div className="space-y-4">
          {selectedUserForEmail && emailForm.destinatar === 'angajat' && (
            <div className="empleados-modal-employee">
              <p className="empleados-modal-employee__name">{selectedUserForEmail['NOMBRE / APELLIDOS']}</p>
              <p className="empleados-modal-employee__meta">Código: {selectedUserForEmail.CODIGO}</p>
            </div>
          )}`,
);

// Welcome email modal
s = s.replace(
  `      <Modal
        isOpen={showWelcomeEmailModal}
        onClose={() => !welcomeEmailLoading && setShowWelcomeEmailModal(false)}
        title=""
        size="lg"
      >
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">✉️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Email de bienvenida a todos</h2>
            <p className="text-gray-600 text-sm">Se enviará a todos los empleados activos. Cada uno recibirá su usuario y contraseña personalizados al final del mensaje. Si algunos fallaron por límite SMTP, usa <strong>Reintentar fallidos</strong> (mismo asunto) para omitir los ya enviados.</p>
          </div>`,
  `      <Modal
        isOpen={showWelcomeEmailModal}
        onClose={() => !welcomeEmailLoading && setShowWelcomeEmailModal(false)}
        title="Email de bienvenida a todos"
        size="lg"
        showCloseButton={false}
        className="app-modal--form"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Se enviará a todos los empleados activos. Cada uno recibirá su usuario y contraseña personalizados al final del mensaje. Si algunos fallaron por límite SMTP, usa <strong>Reintentar fallidos</strong> (mismo asunto) para omitir los ya enviados.</p>`,
);

// Despido title + employee card
s = s.replace('title="🔴 Despido Improcedente"', 'title="Despido improcedente"');
s = s.replace(
  `            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">👤</div>
                <div>
                  <p className="font-bold text-gray-900">
                    {selectedUserForDespido['NOMBRE / APELLIDOS'] || selectedUserForDespido.NOMBRE || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">Código: {selectedUserForDespido.CODIGO}</p>
                </div>
              </div>
            </div>`,
  `            <div className="empleados-modal-employee">
              <p className="empleados-modal-employee__name">{selectedUserForDespido['NOMBRE / APELLIDOS'] || selectedUserForDespido.NOMBRE || 'N/A'}</p>
              <p className="empleados-modal-employee__meta">Código: {selectedUserForDespido.CODIGO}</p>
            </div>`,
);

// Solicitar documento employee card
s = s.replace(
  `            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">👤</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {getFormattedNombre(selectedUserForDocumento) || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Código: {selectedUserForDocumento.CODIGO}
                  </p>
                </div>
              </div>
            </div>`,
  `            <div className="empleados-modal-employee">
              <p className="empleados-modal-employee__name">{getFormattedNombre(selectedUserForDocumento) || 'Sin nombre'}</p>
              <p className="empleados-modal-employee__meta">Código: {selectedUserForDocumento.CODIGO}</p>
            </div>`,
);

// Documento todos info card
s = s.replace(
  `          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {documentoTodosForm.solo_activos 
                    ? users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO').length
                    : users.length
                  } empleados
                </p>
                <p className="text-sm text-gray-600">
                  {documentoTodosForm.solo_activos ? 'Solo activos' : 'Todos los empleados'}
                </p>
              </div>
            </div>
          </div>`,
  `          <div className="empleados-modal-employee">
            <p className="empleados-modal-employee__name">
              {documentoTodosForm.solo_activos
                ? users.filter(u => (u['ESTADO'] || u.ESTADO || '').toString().trim().toUpperCase() === 'ACTIVO').length
                : users.length} empleados
            </p>
            <p className="empleados-modal-employee__meta">{documentoTodosForm.solo_activos ? 'Solo activos' : 'Todos los empleados'}</p>
          </div>`,
);

// Remove gradient classes from Button primary actions in modals
s = s.replace(/ className="px-8 py-3 bg-gradient-to-r[^"]*"/g, ' className="solicitud-admin-btn solicitud-admin-btn--primary"');
s = s.replace(/ className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400"/g, ' className="solicitud-admin-btn"');

// Email modal footer buttons
s = s.replace(
  `        <div className="flex gap-4 justify-center mt-8">
          <Button
            onClick={() => setShowEmailModal(false)}
            variant="outline"
            size="lg"
            className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400"
          >
            <span className="mr-2">✖️</span>
            Cancelar
          </Button>
          <Button
            onClick={handleSendEmail}
            variant="primary"
            size="lg"
            loading={emailLoading || (emailProgress && emailProgress.status !== 'completed')}
            disabled={emailLoading || (emailProgress && emailProgress.status !== 'completed')}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg"
          >
            {emailLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Enviando...
              </>
            ) : (
              <>
                <span className="mr-2">📧</span>
                Enviar Email
              </>
            )}
          </Button>
        </div>`,
  `        <div className="empleados-modal-actions mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={() => setShowEmailModal(false)} className="solicitud-admin-btn">Cancelar</button>
          <button type="button" onClick={handleSendEmail} disabled={emailLoading || (emailProgress && emailProgress.status !== 'completed')} className="solicitud-admin-btn solicitud-admin-btn--primary">
            {emailLoading || (emailProgress && emailProgress.status !== 'completed') ? 'Enviando…' : 'Enviar email'}
          </button>
        </div>`,
);

fs.writeFileSync(filePath, s, 'utf8');
console.log('Empleados polish script applied');
