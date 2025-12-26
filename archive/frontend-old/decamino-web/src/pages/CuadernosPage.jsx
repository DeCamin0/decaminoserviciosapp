import { Link } from 'react-router-dom';
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tareas Diarias */}
          <Link 
            to="/tareas" 
            className="group relative p-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl border border-emerald-200 hover:border-emerald-300 bg-white"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-emerald-400 via-green-400 to-lime-400 opacity-10 group-hover:opacity-25 blur-md transition-all"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white text-2xl">📋</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-900">Tareas Diarias</h3>
                  <p className="text-sm text-green-700">Gestión de tareas por día</p>
                </div>
              </div>
              <div className="text-xs inline-flex items-center gap-2 text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full shadow-sm">
                Entrar
                <span>→</span>
              </div>
            </div>
          </Link>

          {/* CONTROL CORREO/PAQUETERÍA */}
          <Link 
            to="/control-correo" 
            className="group relative p-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl border border-rose-200 hover:border-rose-300 bg-white"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-rose-400 via-red-400 to-amber-400 opacity-10 group-hover:opacity-25 blur-md transition-all"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-rose-500 to-red-600 text-white text-2xl">📦</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-900">CONTROL CORREO/PAQUETERÍA</h3>
                  <p className="text-sm text-red-700">Registro diario de correo y paquetes</p>
                </div>
              </div>
              <div className="text-xs inline-flex items-center gap-2 text-rose-800 bg-rose-100/80 px-3 py-1 rounded-full shadow-sm">
                Entrar
                <span>→</span>
              </div>
            </div>
          </Link>

          {/* INCIDENCIAS / AVERÍAS */}
          <Link 
            to="/incidencias" 
            className="group relative p-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl border border-blue-200 hover:border-blue-300 bg-white"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 opacity-10 group-hover:opacity-25 blur-md transition-all"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl">🔧</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-blue-900">INCIDENCIAS / AVERÍAS</h3>
                  <p className="text-sm text-blue-700">Registro de averías y mantenimiento</p>
                </div>
              </div>
              <div className="text-xs inline-flex items-center gap-2 text-blue-800 bg-blue-100/80 px-3 py-1 rounded-full shadow-sm">
                Entrar
                <span>→</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CuadernosPage;


