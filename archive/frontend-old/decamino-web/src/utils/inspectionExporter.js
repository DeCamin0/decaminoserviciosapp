// Funcție pentru a încărca pdfMake dinamic
const loadPdfMake = async () => {
  if (window.pdfMake) {
    console.log('✅ pdfMake already loaded');
    return window.pdfMake;
  }
  
  console.log('📥 Loading pdfMake dynamically...');
  
  return new Promise((resolve, reject) => {
    // Încarcă pdfMake
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/pdfmake.min.js';
    script1.onload = () => {
      console.log('✅ pdfMake loaded');
      
      // Încarcă fonturile
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.5/build/vfs_fonts.js';
      script2.onload = () => {
        console.log('✅ Fonts loaded');
        console.log('window.pdfMake:', window.pdfMake);
        console.log('window.pdfMake.vfs:', window.pdfMake?.vfs);
        resolve(window.pdfMake);
      };
      script2.onerror = () => {
        console.error('❌ Failed to load fonts');
        reject(new Error('Failed to load pdfMake fonts'));
      };
      document.head.appendChild(script2);
    };
    script1.onerror = () => {
      console.error('❌ Failed to load pdfMake');
      reject(new Error('Failed to load pdfMake'));
    };
    document.head.appendChild(script1);
  });
};

const getPdfMake = async () => {
  console.log('🔍 Checking pdfMake availability...');
  
  if (!window.pdfMake) {
    console.log('📥 pdfMake not found, loading dynamically...');
    return await loadPdfMake();
  }
  
  console.log('✅ pdfMake found and ready to use');
  return window.pdfMake;
};

// Funcție pentru a obține logo-ul DeCamino ca base64
const getDeCaminoLogo = () => {
  // Încearcă să încarci logo-ul din public
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      // Fallback dacă logo-ul nu există
      resolve(null);
    };
    img.src = window.location.hostname.includes('ngrok') 
      ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo='
      : './logo.svg';
  });
};

// Funcție pentru a converti semnăturile în format PDF
const convertSignatureToPDF = (signatureData) => {
  if (!signatureData) return null;
  
  return {
    image: signatureData,
    width: 150,
    height: 60,
    alignment: 'center'
  };
};

// Funcție pentru a obține textul pentru rang
const getRangoText = (rango) => {
  const rangos = {
    1: '1 - Muy malo',
    2: '2 - Malo', 
    3: '3 - Regular',
    4: '4 - Bueno',
    5: '5 - Excelente'
  };
  return rangos[rango] || 'N/A';
};

// Funcție pentru a obține textul pentru calitate
const getCalidadText = (calidad) => {
  const calidades = {
    1: '1 - Muy malo',
    2: '2 - Malo',
    3: '3 - Regular', 
    4: '4 - Bueno',
    5: '5 - Excelente'
  };
  return calidades[calidad] || 'N/A';
};

// Funcție pentru a genera PDF-ul de inspecție
export const generateInspectionPDF = async (inspectionData) => {
  try {
    const pdfMake = await getPdfMake();
    const logo = await getDeCaminoLogo();
    
    // Definirea documentului PDF
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      header: {
        columns: [
          {
            image: logo,
            width: 80,
            height: 40,
            alignment: 'left'
          },
          {
            text: 'DE CAMINO SERVICIOS AUXILIARES SL',
            style: 'headerTitle',
            alignment: 'right'
          }
        ],
        margin: [40, 20, 40, 0]
      },
      footer: function(currentPage, pageCount) {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          margin: [40, 0, 40, 20],
          style: 'footer'
        };
      },
      content: [
        // Titlu principal
        {
          text: inspectionData.type === 'limpieza' 
            ? 'INSPECCIÓN DE LIMPIEZA' 
            : 'INSPECCIÓN DE SERVICIOS AUXILIARES',
          style: 'mainTitle',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        
        // Informații generale
        {
          text: 'DATOS GENERALES',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'Fecha:', style: 'label' },
                { text: inspectionData.fecha, style: 'value' }
              ],
              [
                { text: 'Hora:', style: 'label' },
                { text: inspectionData.hora, style: 'value' }
              ],
              [
                { text: 'Supervisor:', style: 'label' },
                { text: inspectionData.supervisor, style: 'value' }
              ],
              [
                { text: 'Centro:', style: 'label' },
                { text: inspectionData.centro, style: 'value' }
              ],
              [
                { text: 'Trabajador:', style: 'label' },
                { text: inspectionData.trabajador, style: 'value' }
              ],
              [
                { text: 'Servicio:', style: 'label' },
                { text: inspectionData.servicio, style: 'value' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        },
        
        // Checkboxes
        {
          text: 'VERIFICACIONES',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                { 
                  text: [
                    { text: '☐ ', style: 'checkbox' },
                    { text: 'UNIFORME', style: 'checkboxLabel' }
                  ],
                  style: inspectionData.uniforme ? 'checkboxChecked' : 'checkboxUnchecked'
                }
              ],
              [
                { 
                  text: [
                    { text: '☐ ', style: 'checkbox' },
                    { text: '¿EN HORARIO DE TRABAJO?', style: 'checkboxLabel' }
                  ],
                  style: inspectionData.enHorarioTrabajo ? 'checkboxChecked' : 'checkboxUnchecked'
                }
              ],
              [
                { 
                  text: [
                    { text: '☐ ', style: 'checkbox' },
                    { text: '¿CONFIRMANDO CLIENTE?', style: 'checkboxLabel' }
                  ],
                  style: inspectionData.confirmandoCliente ? 'checkboxChecked' : 'checkboxUnchecked'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20]
        },
        
        // Registro de supervisión
        {
          text: 'REGISTRO DE SUPERVISIÓN DE SERVICIO',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', '*'],
            body: [
              [
                { text: 'ZONA', style: 'tableHeader' },
                { text: 'RANGO', style: 'tableHeader' },
                { text: 'OBSERVACIONES', style: 'tableHeader' }
              ],
              ...Object.entries(inspectionData.zones).map(([zone, data]) => [
                { text: zone, style: 'tableCell' },
                { text: getRangoText(data.rango), style: 'tableCell' },
                { text: data.observaciones || '-', style: 'tableCell' }
              ])
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        },
        
        // Encuesta de calidad
        {
          text: 'ENCUESTA DE CALIDAD',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: '¿Cómo valora el trabajo de DeCamino?', style: 'label' },
                { text: getCalidadText(inspectionData.calidadDeCamino), style: 'value' }
              ],
              [
                { text: '¿Cómo valora el trabajo de la empleada?', style: 'label' },
                { text: getCalidadText(inspectionData.calidadEmpleada), style: 'value' }
              ],
              [
                { text: '¿Qué mejoraría?', style: 'label' },
                { text: inspectionData.mejoras || '-', style: 'value' }
              ],
              [
                { text: '¿Seguiría con DeCamino?', style: 'label' },
                { text: inspectionData.seguiriaDeCamino ? 'Sí' : 'No', style: 'value' }
              ],
              [
                { text: '¿Recomendaría DeCamino?', style: 'label' },
                { text: inspectionData.recomendariaDeCamino ? 'Sí' : 'No', style: 'value' }
              ],
              [
                { text: 'Contacto:', style: 'label' },
                { 
                  text: `${inspectionData.mailContacto || '-'} | ${inspectionData.telefonoContacto || '-'}`, 
                  style: 'value' 
                }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        },
        
        // Justificări dacă există
        ...(inspectionData.justificacionNoSeguiria ? [{
          text: 'Justificación - No seguiría:',
          style: 'label',
          margin: [0, 10, 0, 5]
        }, {
          text: inspectionData.justificacionNoSeguiria,
          style: 'justification',
          margin: [0, 0, 0, 10]
        }] : []),
        
        ...(inspectionData.justificacionNoRecomendaria ? [{
          text: 'Justificación - No recomendaría:',
          style: 'label',
          margin: [0, 10, 0, 5]
        }, {
          text: inspectionData.justificacionNoRecomendaria,
          style: 'justification',
          margin: [0, 0, 0, 20]
        }] : []),
        
        // Firmas
        {
          text: 'FIRMAS',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'FDO TRABAJADOR', style: 'signatureTitle' },
                convertSignatureToPDF(inspectionData.signatures?.trabajador) || {
                  text: 'No firmado',
                  style: 'noSignature'
                }
              ]
            },
            {
              width: '*',
              stack: [
                { text: 'FDO CLIENTE', style: 'signatureTitle' },
                convertSignatureToPDF(inspectionData.signatures?.cliente) || {
                  text: 'No firmado',
                  style: 'noSignature'
                }
              ]
            }
          ],
          margin: [0, 0, 0, 20]
        },
        
        // Informații suplimentare
        {
          text: [
            { text: 'Documento generado el: ', style: 'footer' },
            { text: new Date().toLocaleString('es-ES'), style: 'footer' }
          ],
          alignment: 'center',
          margin: [0, 20, 0, 0]
        }
      ],
      
      // Stiluri pentru document
      styles: {
        headerTitle: {
          fontSize: 16,
          bold: true,
          color: '#E53935'
        },
        mainTitle: {
          fontSize: 20,
          bold: true,
          color: '#E53935',
          margin: [0, 20, 0, 20]
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          color: '#E53935',
          margin: [0, 10, 0, 10]
        },
        label: {
          fontSize: 10,
          bold: true,
          color: '#333333'
        },
        value: {
          fontSize: 10,
          color: '#666666'
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          color: '#FFFFFF',
          fillColor: '#E53935',
          alignment: 'center'
        },
        tableCell: {
          fontSize: 9,
          color: '#333333'
        },
        checkbox: {
          fontSize: 12,
          color: '#E53935'
        },
        checkboxLabel: {
          fontSize: 10,
          color: '#333333'
        },
        checkboxChecked: {
          fontSize: 10,
          color: '#4CAF50'
        },
        checkboxUnchecked: {
          fontSize: 10,
          color: '#666666'
        },
        signatureTitle: {
          fontSize: 10,
          bold: true,
          color: '#E53935',
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        noSignature: {
          fontSize: 10,
          color: '#999999',
          alignment: 'center',
          fontStyle: 'italic'
        },
        justification: {
          fontSize: 9,
          color: '#666666',
          fontStyle: 'italic'
        },
        footer: {
          fontSize: 8,
          color: '#999999'
        }
      },
      
      // Configurații pentru paginare
      pageBreakBefore: function(currentNode, followingNodesOnPage) {
        return currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0;
      }
    };
    
    // Generează PDF-ul
    const pdfDoc = pdfMake.createPdf(docDefinition);
    
    return pdfDoc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Funcție pentru a descărca PDF-ul
export const downloadInspectionPDF = async (inspectionData, filename = null) => {
  try {
    console.log('📄 Starting PDF download...');
    console.log('Inspection data:', inspectionData);
    
    const pdfDoc = await generateInspectionPDF(inspectionData);
    console.log('✅ PDF generated successfully');
    
    const defaultFilename = `inspeccion_${inspectionData.type}_${inspectionData.centro}_${inspectionData.fecha}.pdf`;
    const finalFilename = filename || defaultFilename;
    console.log('📁 Filename:', finalFilename);
    
    pdfDoc.download(finalFilename);
    console.log('✅ PDF download initiated');
    
    return true;
  } catch (error) {
    console.error('❌ Error downloading PDF:', error);
    throw error;
  }
};

// Funcție pentru a deschide PDF-ul în browser
export const openInspectionPDF = async (inspectionData) => {
  try {
    console.log('🖨️ Starting PDF print...');
    console.log('Inspection data:', inspectionData);
    
    const pdfDoc = await generateInspectionPDF(inspectionData);
    console.log('✅ PDF generated successfully');
    
    pdfDoc.open();
    console.log('✅ PDF opened in browser');
    
    return true;
  } catch (error) {
    console.error('❌ Error opening PDF:', error);
    throw error;
  }
};

// Funcție pentru a exporta toate inspecțiile ca ZIP
export const exportAllInspections = async (inspections) => {
  try {
    const JSZip = await import('jszip');
    const zip = new JSZip.default();
    
    // Generează PDF-uri pentru toate inspecțiile
    for (let i = 0; i < inspections.length; i++) {
      const inspection = inspections[i];
      const pdfDoc = await generateInspectionPDF(inspection);
      
      // Convertește PDF-ul în blob
      const pdfBlob = await new Promise((resolve) => {
        pdfDoc.getBlob((blob) => {
          resolve(blob);
        });
      });
      
      // Adaugă în ZIP
      const filename = `inspeccion_${inspection.type}_${inspection.centro}_${inspection.fecha}.pdf`;
      zip.file(filename, pdfBlob);
    }
    
    // Generează și descarcă ZIP-ul
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inspecciones_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error exporting all inspections:', error);
    throw error;
  }
};

// Funcție pentru a exporta inspecțiile în format Excel
export const exportInspectionsToExcel = (inspections) => {
  try {
    // Creează datele pentru Excel
    const excelData = inspections.map(inspection => ({
      'Fecha': inspection.fecha,
      'Hora': inspection.hora,
      'Supervisor': inspection.supervisor,
      'Centro': inspection.centro,
      'Trabajador': inspection.trabajador,
      'Servicio': inspection.servicio,
      'Tipo': inspection.type === 'limpieza' ? 'Limpieza' : 'Servicios Auxiliares',
      'Uniforme': inspection.uniforme ? 'Sí' : 'No',
      'En Horario': inspection.enHorarioTrabajo ? 'Sí' : 'No',
      'Confirmando Cliente': inspection.confirmandoCliente ? 'Sí' : 'No',
      'Calidad DeCamino': getCalidadText(inspection.calidadDeCamino),
      'Calidad Empleada': getCalidadText(inspection.calidadEmpleada),
      'Mejoras': inspection.mejoras || '',
      'Seguiría DeCamino': inspection.seguiriaDeCamino ? 'Sí' : 'No',
      'Recomendaría DeCamino': inspection.recomendariaDeCamino ? 'Sí' : 'No',
      'Contacto': `${inspection.mailContacto || ''} | ${inspection.telefonoContacto || ''}`,
      'Firma Trabajador': inspection.signatures?.trabajador ? 'Sí' : 'No',
      'Firma Cliente': inspection.signatures?.cliente ? 'Sí' : 'No'
    }));
    
    // Convertește în CSV
    const headers = Object.keys(excelData[0]);
    const csvContent = [
      headers.join(','),
      ...excelData.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n');
    
    // Descarcă fișierul CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inspecciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};



// Funcție pentru a deschide PDF-ul în browser
// (duplicate removed - function already defined above)



// Funcție pentru a exporta toate inspecțiile ca ZIP

// (duplicate removed - function already defined above)



// Funcție pentru a exporta inspecțiile în format Excel

// (duplicate removed - function already defined above) 
