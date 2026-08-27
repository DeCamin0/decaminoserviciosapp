const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/pages/DocumentosEmpleadosPage.jsx');
let src = fs.readFileSync(filePath, 'utf8');

const pattern = /<div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-red-50">[\s\S]*?{\/\* Contenido de tabs \*\/}\s*<div[\s\S]*?boxShadow: '0 25px 50px rgba\(0, 0, 0, 0\.05\), inset 0 1px 0 rgba\(255, 255, 255, 0\.6\)'\s*}}\s*>\s*/;

const replacement = `<div className="app-page documentos-empleados-page">
      <PageHeader
        title="Documentos por Empleado"
        subtitle="Gestiona documentos, nóminas y certificados por empleado"
        backTo="/inicio"
        actions={
          (isManager || authUser?.GRUPO === 'Admin' || authUser?.GRUPO === 'Developer' || authUser?.GRUPO === 'Supervisor') ? (
            <div className="documentos-empleados-header-actions flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={fetchEmpleadosConStatusContratos}
                disabled={loadingContratos}
                className="solicitud-admin-btn"
                title="Ver lista de empleados con status de contratos"
              >
                <FileSpreadsheet className={\`w-4 h-4 \${loadingContratos ? 'animate-spin' : ''}\`} aria-hidden />
                <span className="hidden sm:inline">Status contratos</span>
              </button>
              <EmailIngestionButton />
              <FolderIngestionButton />
            </div>
          ) : null
        }
      />

      <SegmentedControl
        layout="grid"
        value={activeTab}
        onChange={handleMainTabChange}
        className="documentos-empleados-main-tabs"
        items={mainTabs}
      />

      {selectedEmpleado && activeTab === 'empleados' && (
        <div className="documentos-empleados-context app-card app-card--pad">
          <div className="documentos-empleados-context__row">
            <div className="documentos-empleados-context__identity min-w-0">
              <div className="documentos-empleados-avatar">
                {employeeAvatars[selectedEmpleado.CODIGO] ? (
                  <img src={employeeAvatars[selectedEmpleado.CODIGO]} alt="" />
                ) : (
                  <span>{getEmpleadoInitials(selectedEmpleado)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="documentos-empleados-context__name truncate">
                  {selectedEmpleado['NOMBRE / APELLIDOS'] || 'Empleado'}
                </p>
                <p className="documentos-empleados-context__meta truncate">
                  {selectedEmpleado.CODIGO}
                  {selectedEmpleado['CENTRO TRABAJO'] ? \` · \${selectedEmpleado['CENTRO TRABAJO']}\` : ''}
                  {selectedEmpleado.GRUPO ? \` · \${selectedEmpleado.GRUPO}\` : ''}
                </p>
              </div>
            </div>
            {volverEmpleadosBtn}
          </div>
          <SegmentedControl
            layout="grid"
            value={activeEmpleadoTab}
            onChange={setActiveEmpleadoTab}
            className="documentos-empleados-sub-tabs"
            items={empleadoSubTabs}
          />
        </div>
      )}

      <div className="documentos-empleados-tab-panel app-card app-card--pad">
`;

if (!pattern.test(src)) {
  console.error('shell pattern not found');
  process.exit(1);
}
src = src.replace(pattern, replacement);
fs.writeFileSync(filePath, src, 'utf8');
console.log('shell OK');
