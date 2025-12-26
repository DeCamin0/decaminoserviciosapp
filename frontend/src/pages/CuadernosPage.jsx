import Back3DButton from '../components/Back3DButton';

const CuadernosPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Back3DButton to="/inicio" title="Volver a Inicio" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Cuadernos</h1>
          </div>
          <p className="text-gray-600">Elige el cuaderno que deseas gestionar</p>
        </div>

        {/* ⚠️ PAGINI MUTATE ÎN OLD - NU SE FOLOSESC MOMENTAN (TareasPage, ControlCorreoPage, IncidenciasPage) */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            <strong>Nota:</strong> Las funcionalidades de Tareas Diarias, Control de Correo e Incidencias están temporalmente deshabilitadas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CuadernosPage;


