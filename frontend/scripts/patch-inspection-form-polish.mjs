import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/components/inspections/InspectionForm.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// --- imports ---
if (!src.includes("from './InspectionFormChrome'")) {
  src = src.replace(
    "import { Button, Card, Modal, AlertBanner } from '../ui';",
    "import { Button, Modal, AlertBanner } from '../ui';\nimport { FormSection, FormFieldLabel, SignatureActionCard } from './InspectionFormChrome';\nimport { InspectionTypeIcon } from './inspectionUi';\nimport {\n  Hash, Calendar, Building2, User, Search, PenLine, CheckCircle2,\n  FileText, Plus, Trash2, Package, Loader2, Download, Send, X,\n  AlertTriangle, Info, Euro, Lightbulb,\n} from 'lucide-react';"
  );
}

// --- success ---
src = src.replace(
  /if \(success\) \{\s*return \(\s*<Card className="p-8 text-center">[\s\S]*?<\/Card>\s*\);\s*\}/,
  `if (success) {
    return (
      <div className="inspecciones-form max-w-lg mx-auto">
        <section className="app-card app-card--pad text-center inspecciones-form-success">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" aria-hidden />
          <h2 className="text-lg font-bold text-gray-900 mb-1">¡Inspección Enviada!</h2>
          <p className="text-sm text-gray-600 mb-4">
            La inspección ha sido enviada al backend con FormData y los archivos adjuntos.
          </p>
          <Button type="button" variant="primary" onClick={() => setSuccess(false)}>
            Nueva Inspección
          </Button>
        </section>
      </div>
    );
  }`
);

// --- datos section wrapper ---
src = src.replace(
  /\{\/\* Header ULTRA MODERN con Glassmorphism \*\/\s*<div className="relative group">[\s\S]*?<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">/,
  `<FormSection
        title="Datos de la Inspección"
        subtitle="Completa todos los campos obligatorios"
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">`
);

src = src.replace(
  /\s*<\/div>\s*<\/Card>\s*<\/div>\s*\{\/\* Puncte de inspecție ULTRA MODERN \*\/\}/,
  `
        </div>
      </FormSection>

      {/* Puntos / Materiales */}`
);

// --- label emoji replacements (datos) ---
const labelReplacements = [
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">🆔</span>
              <span>Número de Inspección *</span>
            </label>`,
    `<FormFieldLabel icon={Hash}>Número de Inspección *</FormFieldLabel>`
  ],
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">📅</span>
              <span>Fecha *</span>
            </label>`,
    `<FormFieldLabel icon={Calendar}>Fecha *</FormFieldLabel>`
  ],
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>Centro de Trabajo *</span>
            </label>`,
    `<FormFieldLabel icon={Building2}>Centro de Trabajo *</FormFieldLabel>`
  ],
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">👷</span>
              <span>{isEntregaOtraPersona ? 'Receptor *' : 'Trabajador *'}</span>
            </label>`,
    `<FormFieldLabel icon={User}>{isEntregaOtraPersona ? 'Receptor *' : 'Trabajador *'}</FormFieldLabel>`
  ],
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-base">🏢</span>
                    <span>Centro para esta inspección (opcional)</span>
                  </label>`,
    `<FormFieldLabel icon={Building2}>Centro para esta inspección (opcional)</FormFieldLabel>`
  ],
  [
    `<label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-base">👨‍💼</span>
              <span>Inspector *</span>
            </label>`,
    `<FormFieldLabel icon={User}>Inspector *</FormFieldLabel>`
  ],
];
for (const [from, to] of labelReplacements) {
  src = src.replace(from, to);
}

src = src.replace(
  `<span className="text-gray-400 text-lg">🔍</span>`,
  `<Search className="w-4 h-4 text-gray-400" aria-hidden />`
);

src = src.replaceAll(
  `<span className="text-green-600">✅</span>`,
  `<CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden />`
);
src = src.replaceAll(
  `<span className="text-red-600">❌</span>`,
  `<X className="w-4 h-4 text-red-600 shrink-0" aria-hidden />`
);
src = src.replace(
  `<span>ℹ️</span>`,
  `<Info className="w-3.5 h-3.5 shrink-0" aria-hidden />`
);
src = src.replace(
  `<span>💡</span>`,
  `<Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden />`
);
src = src.replaceAll(
  `<span>⚠️</span>`,
  `<AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />`
);
src = src.replaceAll(
  `<span>✅</span>`,
  `<CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />`
);
src = src.replace(
  `<span className="animate-spin">⏳</span>`,
  `<Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />`
);

// --- puntos section ---
src = src.replace(
  /\{\/\* Puntos \/ Materiales \*\/\s*<div className="relative group">[\s\S]*?\{errors\.puncte && \([\s\S]*?\)\s*\}\s*<\/Card>\s*<\/div>/,
  `{/* Puntos / Materiales */}
      <FormSection
        title={type === 'entrega-materiales' ? 'Materiales' : 'Puntos de Inspección'}
        subtitle={
          type === 'limpieza'
            ? \`Limpieza — \${formData.puncte.length} zonas\`
            : type === 'servicios'
              ? \`Servicios Auxiliares — \${formData.puncte.length} zonas\`
              : type === 'entrega-materiales'
                ? \`\${formData.puncte.length} material\${formData.puncte.length !== 1 ? 'es' : ''}\`
                : \`Personalizada — \${formData.puncte.length} zonas\`
        }
      >
        {(type === 'personalizada' || type === 'entrega-materiales') && (
          <div className="mb-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-[44px]"
              onClick={() => setShowAddPointModal(true)}
            >
              <Plus className="w-4 h-4" aria-hidden />
              {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {formData.puncte.map((point, index) => (
            <div key={point.id} className="inspecciones-check-row">
              <span className="inspecciones-check-row__badge">
                {type === 'entrega-materiales' ? \`Material \${index + 1}\` : \`Zona \${index + 1}\`}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{point.descriere}</p>
                      {type === 'entrega-materiales' && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {point.cantitate ? (
                            <span className="inspecciones-meta-chip">
                              <Package className="w-3.5 h-3.5" aria-hidden />
                              Cantidad: {point.cantitate}
                            </span>
                          ) : null}
                          {point.precio ? (
                            <span className="inspecciones-meta-chip inspecciones-meta-chip--muted">
                              <Euro className="w-3.5 h-3.5" aria-hidden />
                              {parseFloat(point.precio).toFixed(2)} €
                            </span>
                          ) : null}
                          {point.documento ? (
                            <span className="inspecciones-meta-chip inspecciones-meta-chip--muted">
                              <FileText className="w-3.5 h-3.5" aria-hidden />
                              {point.documento.name || 'Documento adjunto'}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {point.tip && type !== 'entrega-materiales' ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Tipo: {point.tip === 'obligatoriu' ? 'Obligatorio' : 'Opcional'}
                        </p>
                      ) : null}
                    </div>
                    {(type === 'personalizada' || type === 'entrega-materiales') && point.isCustom ? (
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(point.id)}
                        className="inspecciones-icon-btn inspecciones-icon-btn--danger"
                        title={type === 'entrega-materiales' ? 'Eliminar material' : 'Eliminar punto'}
                        aria-label={type === 'entrega-materiales' ? 'Eliminar material' : 'Eliminar punto'}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Rango</label>
                  <select
                    value={point.rango}
                    onChange={(e) => handlePointChange(point.id, 'rango', parseInt(e.target.value))}
                    className="inspecciones-input w-full"
                  >
                    {RANGO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Calidad</label>
                  <select
                    value={point.calidad}
                    onChange={(e) => handlePointChange(point.id, 'calidad', parseInt(e.target.value))}
                    className="inspecciones-input w-full"
                  >
                    {RANGO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="inspecciones-form-label inspecciones-form-label--sm">Observaciones</label>
                  <input
                    type="text"
                    value={point.observatii}
                    onChange={(e) => handlePointChange(point.id, 'observatii', e.target.value)}
                    placeholder="Observaciones opcionales..."
                    className="inspecciones-input w-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {errors.puncte ? (
          <p className="inspecciones-form-error mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>{errors.puncte}</span>
          </p>
        ) : null}
      </FormSection>`
);

// --- firmas ---
src = src.replace(
  /\{\/\* Firmas Digitales ULTRA MODERN \*\/\s*<div className="relative group">[\s\S]*?<\/Card>\s*<\/div>\s*\{\/\* Observaciones Generales ULTRA MODERN \*\/\}/,
  `{/* Firmas Digitales */}
      <FormSection
        title="Firmas Digitales"
        subtitle="Firma del inspector y trabajador"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureActionCard
            label="Firma del Inspector"
            signed={!!formData.inspector.semnaturaPng}
            onClick={() => openSignatureModal('inspector')}
            error={errors.inspectorSignature}
          />
          <SignatureActionCard
            label={isEntregaOtraPersona ? 'Firma del Receptor' : 'Firma del Trabajador'}
            signed={!!formData.trabajador.semnaturaPng}
            onClick={() => openSignatureModal('trabajador')}
            disabled={!formData.trabajador.nume || (isEntregaOtraPersona && dniNieOtraPersonaStatus !== true)}
            hint={
              !formData.trabajador.nume
                ? (isEntregaOtraPersona
                  ? 'Primero indica el nombre y DNI/NIE del receptor'
                  : 'Primero selecciona un trabajador')
                : undefined
            }
            error={errors.trabajadorSignature}
          />
        </div>

        {(errors.inspectorSignature || errors.trabajadorSignature) ? (
          <AlertBanner variant="warning" className="mt-4">
            Las firmas son opcionales pero recomendadas para generar un PDF completo.
          </AlertBanner>
        ) : null}
      </FormSection>

      {/* Observaciones Generales */}`
);

// --- observaciones ---
src = src.replace(
  /\{\/\* Observaciones Generales \*\/\s*<div className="relative group">[\s\S]*?<\/Card>\s*<\/div>\s*\{\/\* Botón Submit MEGA WOW \*\/\}/,
  `{/* Observaciones Generales */}
      <FormSection
        title="Observaciones Generales"
        subtitle="Comentarios adicionales (opcional)"
      >
        <textarea
          value={formData.observaciones}
          onChange={(e) => handleInputChange('observaciones', e.target.value)}
          placeholder="Escribe observaciones generales sobre la inspección..."
          rows={4}
          className="inspecciones-input w-full resize-y min-h-[120px]"
        />
      </FormSection>

      {/* Footer CTA */}`
);

// --- submit ---
src = src.replace(
  /\{\/\* Footer CTA \*\/\s*<div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 sticky bottom-4 sm:bottom-6 z-10">[\s\S]*?<\/div>\s*\{\/\* Modal pentru semnături \*\/\}/,
  `{/* Footer CTA */}
      <div className="inspecciones-form-footer">
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto min-h-[44px]"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Generando PDF…
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" aria-hidden />
              Generar y previsualizar PDF
            </>
          )}
        </Button>
      </div>

      {/* Modal semnătură */}`
);

// --- signature modal ---
src = src.replace(
  /\{\/\* Modal semnătură \*\/\s*<Modal[\s\S]*?<\/Modal>\s*\{\/\* Modal pentru adăugarea punctelor personalizate\/materialelor \*\/\}/,
  `{/* Modal semnătură */}
      <Modal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        title={
          signatureType === 'inspector'
            ? 'Firma del inspector'
            : isEntregaOtraPersona
              ? 'Firma del receptor'
              : 'Firma del trabajador'
        }
        size="lg"
        showCloseButton={false}
        className="app-modal--form inspecciones-signature-modal"
        footer={(
          <div className="app-modal__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowSignatureModal(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSignatureSave}>
              Guardar firma
            </Button>
          </div>
        )}
      >
        <SignaturePadComponent
          value={signatureDraft}
          onChange={handleSignatureChange}
        />
      </Modal>

      {/* Modal add point / material */}`
);

// --- add point modal ---
src = src.replace(
  /\{\/\* Modal add point \/ material \*\/\s*<Modal[\s\S]*?<\/Modal>\s*\{\/\* Modal previsualización PDF \*\/\}/,
  `{/* Modal add point / material */}
      <Modal
        isOpen={showAddPointModal}
        onClose={() => setShowAddPointModal(false)}
        title={type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto de Inspección'}
        size="md"
        showCloseButton={false}
        className="app-modal--form inspecciones-add-point-modal"
        footer={(
          <div className="app-modal__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddPointModal(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleAddCustomPoint}>
              {type === 'entrega-materiales' ? 'Añadir Material' : 'Añadir Punto'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <FormFieldLabel>
              {type === 'entrega-materiales' ? 'Descripción del Material *' : 'Descripción del Punto *'}
            </FormFieldLabel>
            <input
              type="text"
              value={newPointData.descriere}
              onChange={(e) => setNewPointData((prev) => ({ ...prev, descriere: e.target.value }))}
              placeholder={
                type === 'entrega-materiales'
                  ? 'Ej: Material de limpieza, Suministros de oficina, Herramientas...'
                  : 'Ej: Estado de las puertas, Limpieza de ventanas...'
              }
              className="app-modal__input w-full"
            />
          </div>

          {type === 'entrega-materiales' ? (
            <>
              <div>
                <FormFieldLabel>Cantidad *</FormFieldLabel>
                <input
                  type="text"
                  value={newPointData.cantitate}
                  onChange={(e) => setNewPointData((prev) => ({ ...prev, cantitate: e.target.value }))}
                  placeholder="Ej: 3, 5 unidades, 10 kg..."
                  className="app-modal__input w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Precio (€)</FormFieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPointData.precio}
                  onChange={(e) => setNewPointData((prev) => ({ ...prev, precio: e.target.value }))}
                  placeholder="Ej: 25.50, 100.00..."
                  className="app-modal__input w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Factura/Albarán (Opcional)</FormFieldLabel>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewPointData((prev) => ({ ...prev, documento: file }));
                  }}
                  className="app-modal__input w-full inspecciones-file-input"
                />
                {newPointData.documento ? (
                  <AlertBanner variant="success" className="mt-2">
                    <span className="flex items-center justify-between gap-2 w-full">
                      <span className="truncate">Archivo: {newPointData.documento.name}</span>
                      <button
                        type="button"
                        onClick={() => setNewPointData((prev) => ({ ...prev, documento: null }))}
                        className="inspecciones-icon-btn shrink-0"
                        aria-label="Eliminar archivo"
                      >
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </span>
                  </AlertBanner>
                ) : null}
              </div>
            </>
          ) : null}

          {type !== 'entrega-materiales' ? (
            <div>
              <FormFieldLabel>Tipo de Punto</FormFieldLabel>
              <select
                value={newPointData.tip}
                onChange={(e) => setNewPointData((prev) => ({ ...prev, tip: e.target.value }))}
                className="app-modal__input w-full"
              >
                <option value="obligatoriu">Obligatorio</option>
                <option value="opcional">Opcional</option>
              </select>
            </div>
          ) : null}

          <div>
            <FormFieldLabel>Observaciones Iniciales (Opcional)</FormFieldLabel>
            <textarea
              value={newPointData.observatii}
              onChange={(e) => setNewPointData((prev) => ({ ...prev, observatii: e.target.value }))}
              placeholder={
                type === 'entrega-materiales'
                  ? 'Observaciones iniciales para este material...'
                  : 'Observaciones iniciales para este punto...'
              }
              rows={3}
              className="app-modal__input w-full resize-y min-h-[96px]"
            />
          </div>
        </div>
      </Modal>

      {/* Modal previsualización PDF */}`
);

// --- pdf modal ---
src = src.replace(
  /\{\/\* Modal previsualización PDF \*\/\s*<Modal[\s\S]*?<\/Modal>\s*<\/div>\s*\);\s*\};/,
  `{/* Modal previsualización PDF */}
      <Modal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Previsualización del PDF"
        size="xl"
        showCloseButton={false}
        className="app-modal--preview app-modal--form inspecciones-pdf-modal__panel"
        footer={(
          <div className="app-modal__actions inspecciones-pdf-form-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = pdfPreviewUrl;
                link.download = \`inspeccion-\${formData.nr}.pdf\`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="w-4 h-4" aria-hidden />
              Descargar PDF
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowPdfPreview(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSendInspection} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden />
                  Enviar Inspección
                </>
              )}
            </Button>
          </div>
        )}
      >
        <div className="inspecciones-pdf-modal__intro">
          <p className="text-sm font-semibold text-gray-800">PDF Generado: {formData.nr}</p>
          <p className="text-xs text-gray-600 mt-1">
            Revisa el contenido del PDF antes de enviar. Puedes descargar el PDF o enviar la inspección.
          </p>
        </div>

        <div className="inspecciones-pdf-modal__frame inspecciones-pdf-modal__frame--form">
          {isAndroid ? (
            <PDFViewerAndroid
              pdfUrl={pdfPreviewUrl}
              className="w-full h-full"
            />
          ) : isIOS ? (
            <object
              data={pdfPreviewUrl}
              type="application/pdf"
              className="inspecciones-pdf-modal__iframe"
            >
              <div className="inspecciones-pdf-modal__state">
                <p className="mb-3 text-sm">No se puede mostrar el PDF en este visor.</p>
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="solicitud-admin-btn solicitud-admin-btn--secondary min-h-[44px]"
                >
                  Abrir el PDF en una nueva pestaña
                </a>
              </div>
            </object>
          ) : (
            <iframe
              src={pdfPreviewUrl}
              title="PDF Preview"
              className="inspecciones-pdf-modal__iframe"
            />
          )}
        </div>

        <AlertBanner variant="info" className="mt-3">
          El PDF contiene todos los datos de la inspección y se enviará en formato Base64 al backend.
        </AlertBanner>
      </Modal>
    </div>
  );
};`
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('InspectionForm polish patch applied.');
