const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/EmpleadosPage.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

const start = lines.findIndex((l) => l.includes('return (') && lines[lines.indexOf(l) + 1]?.includes('<div key={user'));
// find map return - search for getFilteredUsers.map line then next return (
const mapIdx = lines.findIndex((l) => l.includes('getFilteredUsers.map'));
let startIdx = -1;
for (let i = mapIdx; i < mapIdx + 10; i++) {
  if (lines[i].trim() === 'return (') {
    startIdx = i;
    break;
  }
}
if (startIdx < 0) throw new Error('start not found');

let endIdx = startIdx;
let depth = 0;
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes(');})}')) {
    endIdx = i;
    break;
  }
}

const replacement = `                        return (
                          <article key={user['CODIGO'] || idx} className="solicitud-admin-mobile-card">
                            <div className="solicitud-admin-mobile-card__head">
                              <div className="empleados-avatar">
                                {employeeAvatars[user['CODIGO']] ? (
                                  <img src={employeeAvatars[user['CODIGO']]} alt="" />
                                ) : (
                                  getEmployeeInitials(user)
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="solicitud-admin-mobile-card__title truncate">
                                  {getFormattedNombre(user) || 'Sin nombre'}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {user['CODIGO']}
                                  {user['CENTRO TRABAJO'] ? \` · \${user['CENTRO TRABAJO']}\` : ''}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user['CORREO ELECTRONICO']}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {user['ESTADO'] && (
                                  <span className={\`solicitud-status \${empleadoEstadoStatusClass(user['ESTADO'])}\`}>
                                    {(user['ESTADO'] || '').toString().toUpperCase()}
                                  </span>
                                )}
                                {codigo && (
                                  <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
                                    <span className={\`inline-block h-1.5 w-1.5 rounded-full \${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}\`} />
                                    {isOnline ? 'Online' : 'Offline'}
                                  </span>
                                )}
                              </div>
                            </div>
                            {user['GRUPO'] && (
                              <p className="text-xs text-gray-500 mt-1">{user['GRUPO']}</p>
                            )}
                            <div className="solicitud-admin-toolbar documentos-actions mt-2 flex-wrap">
                              <button type="button" onClick={() => openEditModal(user)} className="solicitud-admin-btn solicitud-admin-btn--primary">
                                <Eye className="w-4 h-4" aria-hidden /><span>Ver detalle</span>
                              </button>
                              <button type="button" onClick={() => openEmailModal(user)} className="solicitud-admin-btn" title="Enviar email">
                                <Mail className="w-4 h-4" aria-hidden />
                              </button>
                              <button type="button" onClick={() => handleResetPassword(user)} disabled={loadingPassword} className="solicitud-admin-btn" title="Resetear contraseña">
                                <Key className="w-4 h-4" aria-hidden />
                              </button>
                              <button type="button" onClick={() => openSolicitarDocumentoModal(user)} className="solicitud-admin-btn" title="Solicitar documento">
                                <File className="w-4 h-4" aria-hidden />
                              </button>
                              <button type="button" onClick={() => handleExportEmployeeZIP(user)} className="solicitud-admin-btn" title="Exportar ZIP">
                                <Archive className="w-4 h-4" aria-hidden />
                              </button>
                              <button type="button" onClick={() => handleCrearSolicitudInspeccion(user)} className="solicitud-admin-btn" title="Solicitar inspección">
                                <ClipboardList className="w-4 h-4" aria-hidden />
                              </button>
                              {canCreateTareas && (
                                <button type="button" onClick={() => handleCrearTarea(user)} className="solicitud-admin-btn" title="Crear tarea">
                                  <CheckSquare className="w-4 h-4" aria-hidden />
                                </button>
                              )}
                              {(authUser?.GRUPO === 'Admin' || authUser?.grupo === 'Admin' || authUser?.GRUPO === 'Developer' || authUser?.grupo === 'Developer') && (
                                <button type="button" onClick={() => openDespidoModal(user)} className="solicitud-admin-btn" title="Despido improcedente">
                                  <UserX className="w-4 h-4" aria-hidden />
                                </button>
                              )}
                            </div>
                          </article>
                        );`.split('\n');

lines = [...lines.slice(0, startIdx), ...replacement, ...lines.slice(endIdx + 1)];

// Remove orphaned wrapper divs after map if any
const afterMap = lines.findIndex((l, i) => i > startIdx && l.trim() === '</div>' && lines[i - 1]?.includes(');'));
if (afterMap > 0) {
  // remove up to 3 extra closing divs from old structure
  let removed = 0;
  while (removed < 3 && lines[afterMap + removed]?.trim() === '</div>') {
    lines.splice(afterMap, 1);
    removed++;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Patched list cards', { startIdx, endIdx });
