const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/EmpleadosPage.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const start = s.indexOf('                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">');
const end = s.indexOf('                      </div>\n                    </div>\n                  );', start);
if (start < 0 || end < 0) throw new Error('stats KPI block not found');

const block = `                      <div className="empleados-kpi-strip" role="group" aria-label="Resumen estadísticas">
                        <button
                          type="button"
                          onClick={() => setFiltroActivo(filtroActivo === 'sin_cuadrante_ni_horario' ? null : 'sin_cuadrante_ni_horario')}
                          className={\`empleados-kpi text-left \${filtroActivo === 'sin_cuadrante_ni_horario' ? 'empleados-kpi--active' : ''}\`}
                        >
                          <span className="empleados-kpi__value">{sinCuadranteNiHorario}</span>
                          <span className="empleados-kpi__label">Sin cuadrante ni horario</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroActivo(filtroActivo === 'con_cuadrante' ? null : 'con_cuadrante')}
                          className={\`empleados-kpi text-left \${filtroActivo === 'con_cuadrante' ? 'empleados-kpi--active' : ''}\`}
                        >
                          <span className="empleados-kpi__value">{conCuadrante}</span>
                          <span className="empleados-kpi__label">Con cuadrante</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroActivo(filtroActivo === 'con_horario' ? null : 'con_horario')}
                          className={\`empleados-kpi text-left \${filtroActivo === 'con_horario' ? 'empleados-kpi--active' : ''}\`}
                        >
                          <span className="empleados-kpi__value">{conHorario}</span>
                          <span className="empleados-kpi__label">Con horario</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroActivo(filtroActivo === 'con_ambos' ? null : 'con_ambos')}
                          className={\`empleados-kpi text-left \${filtroActivo === 'con_ambos' ? 'empleados-kpi--active' : ''}\`}
                        >
                          <span className="empleados-kpi__value">{conAmbele}</span>
                          <span className="empleados-kpi__label">Con ambos</span>
                        </button>
                      </div>`;

s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(filePath, s, 'utf8');
console.log('Stats KPI compact applied');
