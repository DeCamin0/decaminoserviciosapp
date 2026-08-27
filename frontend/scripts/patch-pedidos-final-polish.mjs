/**
 * FINAL POLISH — Pedidos UI (no logic changes)
 * Run: node frontend/scripts/patch-pedidos-final-polish.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function patch(file, replacements) {
  const p = path.join(root, file);
  let src = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const [from, to] of replacements) {
    if (!src.includes(from)) {
      console.warn(`[skip] not found in ${file}: ${from.slice(0, 60)}…`);
      continue;
    }
    src = src.split(from).join(to);
    n += 1;
  }
  fs.writeFileSync(p, src);
  console.log(`✓ ${file} — ${n} patches`);
}

// ── PedidosPage.tsx ──
patch('src/pages/PedidosPage.tsx', [
  // Detail meta grid
  ['<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">',
    '<div className="pedidos-detail-meta">'],
  ['<strong>✅ Aprobado por:</strong>', '<span className="pedidos-detail-meta__label pedidos-detail-meta__label--ok">Aprobado por:</span>'],
  ['<strong>❌ Rechazado por:</strong>', '<span className="pedidos-detail-meta__label pedidos-detail-meta__label--err">Rechazado por:</span>'],
  ['<strong>🕐 Horario Entrega:</strong>', '<span className="pedidos-detail-meta__label">Horario entrega:</span>'],
  ['<strong>📞 Teléfono Entrega:</strong>', '<span className="pedidos-detail-meta__label">Teléfono entrega:</span>'],
  ['<strong>📍 Dirección de Envío:</strong>', '<span className="pedidos-detail-meta__label">Dirección de envío:</span>'],
  ['<div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">',
    '<div className="pedidos-notas-block">'],
  ['💾 Guardar Nota', 'Guardar nota'],
  ['💾 Guardar', 'Guardar'],
  ['💾 Guardar Dirección de Envío', 'Guardar dirección'],
  ['📍 Dirección de Envío{\' \'}\n                            {pedido.estado === \'aprobado\'',
    'Dirección de envío{\' \'}\n                            {pedido.estado === \'aprobado\''],
  // Approve row
  ['{pedido.estado === \'pendiente\' && (\n                      <>\n                        <Button\n                          onClick={() => updateEstado(pedido.pedido_uid, \'aprobado\')}\n                          className="bg-green-600 hover:bg-green-700 text-white"\n                          size="sm"\n                        >\n                          ✅ Aprobar\n                        </Button>\n                        <Button\n                          onClick={() => updateEstado(pedido.pedido_uid, \'rechazado\')}\n                          className="bg-red-600 hover:bg-red-700 text-white"\n                          size="sm"\n                        >\n                          ❌ Rechazar\n                        </Button>\n                      </>\n                    )}',
    '{pedido.estado === \'pendiente\' && (\n                      <div className="pedidos-approve-row">\n                        <Button\n                          type="button"\n                          onClick={() => updateEstado(pedido.pedido_uid, \'aprobado\')}\n                          variant="primary"\n                          size="sm"\n                          className="pedidos-approve-row__approve"\n                        >\n                          Aprobar\n                        </Button>\n                        <Button\n                          type="button"\n                          onClick={() => updateEstado(pedido.pedido_uid, \'rechazado\')}\n                          variant="danger"\n                          size="sm"\n                        >\n                          Rechazar\n                        </Button>\n                      </div>\n                    )}'],
  // Expand detail buttons
  ['➕ Añadir Producto', 'Añadir producto'],
  ['💾 Guardar Cambios', 'Guardar cambios'],
  ['➕ Añadir', 'Añadir'],
  // Modal titles
  ['<h2 className="text-xl font-bold text-gray-800">📄 Ver Albarán</h2>',
    '<h2 className="text-xl font-bold text-gray-800">Ver albarán</h2>'],
  ['<h2 className="text-xl sm:text-2xl font-bold text-gray-800">📄 Cargar Albarán</h2>',
    '<h2 className="text-xl sm:text-2xl font-bold text-gray-800">Cargar albarán</h2>'],
  ['{albaranViewDeleting ? \'⏳ Eliminando...\' : \'🗑️ Borrar albarán\'}',
    '{albaranViewDeleting ? \'Eliminando…\' : \'Borrar albarán\'}'],
  ['📥 Descargar albarán', 'Descargar albarán'],
  ['📥 Descargar', 'Descargar'],
  ['<p className="text-gray-600 mb-2">📄 <strong>{albaranViewName}</strong></p>',
    '<p className="text-gray-600 mb-2"><strong>{albaranViewName}</strong></p>'],
  ['{enviandoProveedor ? \'⏳ Enviando...\' : \'📤 Enviar a Proveedor y Marcar como Enviado\'}',
    '{enviandoProveedor ? \'Enviando…\' : \'Enviar a proveedor y marcar como enviado\'}'],
  ['<strong>📋 Nota:</strong>', '<strong>Nota:</strong>'],
  ['<strong>📞 Teléfono (envío):</strong>', '<span class="pedidos-detail-meta__label">Teléfono (envío):</span>'],
  // Modal shells
  ['<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">',
    '<div className="pedidos-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">'],
  ['<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">',
    '<div className="pedidos-modal-overlay fixed inset-0 flex items-center justify-center z-50">'],
  ['<div className="fixed inset-0 z-[10060] flex items-end landscape:items-center justify-center bg-black/50 p-0 landscape:p-2 sm:p-4">',
    '<div className="pedidos-modal-overlay pedidos-modal-overlay--sheet fixed inset-0 z-[10060] flex items-end landscape:items-center justify-center p-0 landscape:p-2 sm:p-4">'],
  ['<div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">',
    '<div className="pedidos-modal-panel bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">'],
  ['<div className="bg-white rounded-t-2xl landscape:rounded-lg sm:rounded-lg shadow-xl max-w-2xl landscape:max-w-4xl w-full max-h-[min(92dvh,100%)] landscape:max-h-[min(96dvh,100%)] flex flex-col overflow-hidden">',
    '<div className="pedidos-modal-panel pedidos-modal-panel--sheet bg-white rounded-t-2xl landscape:rounded-lg sm:rounded-lg max-w-2xl landscape:max-w-4xl w-full max-h-[min(92dvh,100%)] landscape:max-h-[min(96dvh,100%)] flex flex-col overflow-hidden">'],
  // Catalog legacy
  ['group-hover:scale-105 transition-transform duration-300', ''],
  ['<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">',
    '<div className="w-full h-full flex items-center justify-center bg-gray-50">'],
  ['<span className="mr-1">✏️</span>', ''],
  ['✅ Permitir Todos', 'Permitir todos'],
  ['❌ Denegar Todos', 'Denegar todos'],
  ['➕ Agregar', 'Agregar'],
  ['❌ Cancelar', 'Cancelar'],
  ['💾 Guardar', 'Guardar'],
  ['➕ Añadir Nota Nueva', 'Añadir nota nueva'],
  ['✏️ Editar', 'Editar'],
  ['🗑️ Eliminar', 'Eliminar'],
]);

// ── EmpleadoPedidosPage.tsx ──
patch('src/pages/EmpleadoPedidosPage.tsx', [
  ['<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">',
    '<div className="pedidos-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">'],
  ['<div className="fixed inset-0 z-[10060] flex items-end landscape:items-center justify-center bg-black/50 p-0 landscape:p-2 sm:p-4">',
    '<div className="pedidos-modal-overlay pedidos-modal-overlay--sheet fixed inset-0 z-[10060] flex items-end landscape:items-center justify-center p-0 landscape:p-2 sm:p-4">'],
  ['<div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">',
    '<div className="pedidos-modal-panel bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">'],
  ['<h2 className="text-2xl font-bold text-gray-800">✏️ Editar Pedido:',
    '<h2 className="text-2xl font-bold text-gray-800">Editar pedido:'],
  ['{guardando ? \'Guardando...\' : \'💾 Guardar Cambios\'}',
    '{guardando ? \'Guardando…\' : \'Guardar cambios\'}'],
  ['<h2 className="text-xl font-bold text-gray-800">📄 Ver Albarán</h2>',
    '<h2 className="text-xl font-bold text-gray-800">Ver albarán</h2>'],
  ['<h2 className="text-xl sm:text-2xl font-bold text-gray-800">📄 Cargar Albarán</h2>',
    '<h2 className="text-xl sm:text-2xl font-bold text-gray-800">Cargar albarán</h2>'],
  ['📄 <strong>{albaranViewName}</strong>', '<strong>{albaranViewName}</strong>'],
  // Employee albarán warning callout — emoji only
  ['<span className="text-yellow-600 text-lg">⚠️</span>', ''],
  ['<div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">',
    '<div className="pedidos-callout pedidos-callout--warn mt-3">'],
]);

console.log('Done.');
