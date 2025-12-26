// Utilitar pentru generarea PDF-urilor pentru facturi
// Folosește @react-pdf/renderer pentru generarea documentelor

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';
import { routes } from '../../../utils/routes';

// Funcție pentru a încărca lista de clienți
export const fetchClientes = async () => {
  try {
    console.log('Fetching clientes from:', routes.getClientes);
    const response = await fetch(routes.getClientes);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Clientes data received:', data);
    
    const clientesData = Array.isArray(data) ? data : [];
    // Filtrează doar clienții (nu furnizorii)
    const soloClientes = clientesData.filter(item => item.tipo !== 'proveedor');
    
    return soloClientes;
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return [];
  }
};

// Funcție pentru a găsi un client după NIF sau nume
export const findCliente = (clientes, searchTerm) => {
  if (!clientes || !searchTerm) return null;
  
  return clientes.find(cliente => 
    cliente.NIF === searchTerm || 
    cliente['NOMBRE O RAZON SOCIAL'] === searchTerm ||
    cliente['NOMBRE O RAZON SOCIAL']?.toLowerCase().includes(searchTerm.toLowerCase())
  );
};

// Funcție pentru a formata data în format spaniol
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Funcție pentru a formata suma în format spaniol
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

// Funcție pentru a obține statusul în spaniolă
// const getStatusText = (status) => { // Unused function
//   const statusMap = {
//     'borrador': 'Borrador',
//     'enviado': 'Enviado',
//     'efactura-pendiente': 'eFactura Pendiente',
//     'pagado': 'Pagado'
//   };
//   return statusMap[status] || status;
// };

// Stiluri pentru PDF - exact ca Factura_2025-0605.pdf
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    position: 'relative'
  },
  // Stil pentru logo-ul de fundal (watermark)
  backgroundLogo: {
    position: 'absolute',
    top: 43,             // mai jos cu puțin față de 38
    left: 10,            // mai spre stânga (de la 20 → 10)
    width: 180,          // dimensiune mică
    height: 100,         // proporțional
    opacity: 0.08,       // subtil
    zIndex: -1
  },
  verticalText: {
    position: 'absolute',
    top: '30%',
    left: -430,
    transform: 'rotate(-90deg)',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
    width: 900,
    textAlign: 'left',
    zIndex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '2 solid #000000',
    paddingBottom: 15
  },
  headerLeft: {
    flexDirection: 'column',
    flex: 1
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5
  },
  companySubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8
  },
  companyInfo: {
    fontSize: 9,
    color: '#000000',
    marginBottom: 2,
    lineHeight: 1.3
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'right'
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'right',
    color: '#000000'
  },
  invoiceInfo: {
    fontSize: 10,
    marginBottom: 3,
    textAlign: 'right',
    color: '#000000'
  },
  clientSection: {
    marginBottom: 20,
    border: '1 solid #000000',
    padding: 12,
    backgroundColor: '#f8f9fa'
  },
  clientTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000000'
  },
  clientInfo: {
    fontSize: 9,
    color: '#000000',
    marginBottom: 2
  },
  section: {
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    borderBottom: '1 solid #000000',
    paddingBottom: 3,
    textTransform: 'uppercase'
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 15
  },
  tableRow: {
    flexDirection: 'row'
  },
  tableHeader: {
    backgroundColor: '#e9ecef',
    fontWeight: 'bold',
    color: '#000000',
    fontSize: 9
  },
  tableCell: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 1,
    textAlign: 'left',
    fontSize: 9
  },
  tableCellCenter: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 1,
    textAlign: 'center',
    fontSize: 9
  },
  tableCellRight: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 1,
    textAlign: 'right',
    fontSize: 9
  },
  // Stiluri specifice pentru coloane cu lățimi personalizate
  tableCellConcepto: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 3.6, // 60% din 6 coloane = 3.6
    textAlign: 'left',
    fontSize: 9
  },
  tableCellUds: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.3, // 5% din 6 coloane = 0.3
    textAlign: 'center',
    fontSize: 9
  },
  tableCellBaseUd: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.6, // 10% din 6 coloane = 0.6
    textAlign: 'right',
    fontSize: 9
  },
  tableCellBaseTotal: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.6, // 10% din 6 coloane = 0.6
    textAlign: 'right',
    fontSize: 9
  },
  tableCellIvaPercent: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.3, // 5% din 6 coloane = 0.3
    textAlign: 'center',
    fontSize: 9
  },
  tableCellIva: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.6, // 10% din 6 coloane = 0.6
    textAlign: 'right',
    fontSize: 9
  },
  tableCellDescuento: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    flex: 0.3, // 5% din 7 coloane = 0.3
    textAlign: 'center',
    fontSize: 9
  },
  // Stiluri pentru text pe două rânduri în header
  headerTextTop: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 1
  },
  headerTextBottom: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center'
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15
  },
  totalsColumn: {
    width: 200
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2
  },
  totalLabel: {
    fontSize: 10,
    color: '#000000'
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000'
  },
  totalLabelBold: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000'
  },
  totalValueBold: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000'
  },
  observaciones: {
    fontSize: 9,
    color: '#000000',
    fontStyle: 'italic',
    marginBottom: 15,
    padding: 8,
    backgroundColor: '#f8f9fa',
    border: '1 solid #000000'
  },
  pagoDomiciliado: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
    border: '2 solid #000000',
    padding: 6,
    backgroundColor: '#f8f9fa'
  },
  footer: {
    fontSize: 10,
    color: '#000000',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    borderTop: '1 solid #000000',
    paddingTop: 10
  }
});

// Componenta PDF pentru factură - exact ca Factura_2025-0605.pdf
const FacturaPDF = ({ factura, cliente }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* LOGO DE FONDAL (WATERMARK) */}
      <Image 
        src={window.location.hostname.includes('ngrok') 
          ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo='
          : './logo.svg'
        }
        style={styles.backgroundLogo}
      />
      
      {/* TEXT VERTICAL FIX */}
      <Text style={styles.verticalText}>
        DE CAMINO SERVICIOS AUXILIARES SL, - CIF B-85524536 - Inscrita en R.M. Madrid - T260005-Lº0-Fº180-Secc.8-HOJA M-468812
      </Text>

      {/* Header cu logo și informații companie */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.companyName}>DE CAMINO</Text>
          <Text style={styles.companySubtitle}>SERVICIOS AUXILIARES SL</Text>
          <Text style={styles.companyInfo}>CIF B-85524536</Text>
          <Text style={styles.companyInfo}>Avda Euzkadi 14</Text>
          <Text style={styles.companyInfo}>28702 San Sebastián de los Reyes</Text>
          <Text style={styles.companyInfo}>MADRID, España</Text>
          <Text style={styles.companyInfo}>decaminoservicios@gmail.com</Text>
        </View>
                 <View style={styles.headerRight}>
           <Text style={styles.invoiceTitle}>FACTURA</Text>
           <Text style={styles.invoiceNumber}>Nº: {factura.numero}</Text>
           <Text style={styles.invoiceInfo}>Fecha: {formatDate(factura.fecha)}</Text>
         </View>
      </View>

      {/* Informații client */}
      <View style={styles.clientSection}>
        <Text style={styles.clientTitle}>DATOS DEL CLIENTE</Text>
        <Text style={styles.clientName}>{cliente?.['NOMBRE O RAZON SOCIAL'] || factura.cliente || 'Cliente no especificado'}</Text>
        <Text style={styles.clientInfo}>{cliente?.DIRECCION || 'Dirección del cliente'}</Text>
        <Text style={styles.clientInfo}>{cliente?.POBLACION || 'Código postal y ciudad'}</Text>
        <Text style={styles.clientInfo}>{cliente?.PAIS || 'País'}</Text>
        <Text style={styles.clientInfo}>NIF/CIF: {cliente?.NIF || 'NIF/CIF del cliente'}</Text>
      </View>

      {/* Tabel cu produse/servicii */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DETALLE DE PRODUCTOS/SERVICIOS</Text>
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCellConcepto}>CONCEPTO</Text>
            <Text style={styles.tableCellUds}>UDS.</Text>
            <Text style={styles.tableCellBaseUd}>BASE UD.</Text>
            <View style={styles.tableCellBaseTotal}>
              <Text style={styles.headerTextTop}>BASE</Text>
              <Text style={styles.headerTextBottom}>TOTAL</Text>
            </View>
            <Text style={styles.tableCellIvaPercent}>% IVA</Text>
            <Text style={styles.tableCellDescuento}>% DESC.</Text>
            <Text style={styles.tableCellIva}>IVA</Text>
          </View>
          {/* Rows */}
          {factura.items?.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCellConcepto}>{item.descripcion || 'Sin descripción'}</Text>
              <Text style={styles.tableCellUds}>{item.cantidad || 0}</Text>
              <Text style={styles.tableCellBaseUd}>{formatCurrency(item.precioUnitario || 0)}</Text>
              <Text style={styles.tableCellBaseTotal}>
                {formatCurrency((item.cantidad || 0) * (item.precioUnitario || 0))}
              </Text>
              <Text style={styles.tableCellIvaPercent}>{item.tva || 0}%</Text>
              <Text style={styles.tableCellDescuento}>{item.descuento || 0}%</Text>
              <Text style={styles.tableCellIva}>
                {formatCurrency(((item.cantidad || 0) * (item.precioUnitario || 0)) * ((item.tva || 0) / 100))}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Totaluri */}
      <View style={styles.totals}>
        <View style={styles.totalsColumn}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(factura.subtotal || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA:</Text>
            <Text style={styles.totalValue}>{formatCurrency(factura.totalTVA || 0)}</Text>
          </View>
          {factura.totalRetencion && factura.totalRetencion > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Retención:</Text>
              <Text style={styles.totalValue}>{formatCurrency(factura.totalRetencion)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTop: '1 solid #000000', paddingTop: 8 }]}>
            <Text style={styles.totalLabelBold}>TOTAL:</Text>
            <Text style={styles.totalValueBold}>{formatCurrency(factura.total || 0)}</Text>
          </View>
        </View>
      </View>

      {/* Observaciones */}
      {factura.observaciones && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OBSERVACIONES</Text>
          <Text style={styles.observaciones}>{factura.observaciones}</Text>
        </View>
      )}

      {/* PAGO DOMICILIADO */}
      <View style={styles.pagoDomiciliado}>
        <Text>PAGO DOMICILIADO</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Gracias por su confianza - DE CAMINO Servicios Auxiliares SL</Text>
    </Page>
  </Document>
);

// Funcție pentru a descărca PDF-ul
export const downloadFacturaPDF = async (factura) => {
  try {
    console.log('📄 Starting PDF download...');
    console.log('Factura data:', factura);
    
    // Carga la lista de clientes
    const clientes = await fetchClientes();
    console.log('Clientes loaded:', clientes.length);
    
    // Encuentra el cliente para esta factura
    const cliente = findCliente(clientes, factura.cliente);
    console.log('Cliente found:', cliente);
    
    const blob = await pdf(<FacturaPDF factura={factura} cliente={cliente} />).toBlob();
    const url = URL.createObjectURL(blob);
    
    const defaultFilename = `Factura_${factura.numero}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
    console.log('📁 Filename:', defaultFilename);
    
    if (factura.downloadOnlyBlob) {
      URL.revokeObjectURL(url);
      return { success: true, blob };
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('✅ PDF download initiated');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error downloading PDF:', error);
    return { success: false, error: 'Error al descargar el PDF' };
  }
};

// Funcție pentru a deschide PDF-ul în browser
export const openFacturaPDF = async (factura) => {
  try {
    console.log('🖨️ Starting PDF print...');
    console.log('Factura data:', factura);
    
    // Carga la lista de clientes
    const clientes = await fetchClientes();
    console.log('Clientes loaded:', clientes.length);
    
    // Encuentra el cliente para esta factura
    const cliente = findCliente(clientes, factura.cliente);
    console.log('Cliente found:', cliente);
    
    const blob = await pdf(<FacturaPDF factura={factura} cliente={cliente} />).toBlob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('✅ PDF opened in browser');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error opening PDF:', error);
    return { success: false, error: 'Error al abrir el PDF' };
  }
};