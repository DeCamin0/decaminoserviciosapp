import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image
} from '@react-pdf/renderer';
import logoImg from '@/assets/logo.svg';

// Înregistrează fonturile - folosim fonturile built-in pentru compatibilitate
// Font.register nu este necesar pentru fonturile standard

// Stiluri pentru PDF - optimizate pentru o singură pagină
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20, // Redus de la 30 la 20
    fontFamily: 'Helvetica',
    position: 'relative'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15, // Redus de la 30 la 15
    paddingBottom: 10, // Redus de la 20 la 10
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626'
  },
  logo: {
    width: 50, // Redus de la 60 la 50
    height: 50, // Redus de la 60 la 50
    marginRight: 15 // Redus de la 20 la 15
  },
  headerText: {
    flex: 1
  },
  companyName: {
    fontSize: 18, // Redus de la 20 la 18
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 3 // Redus de la 5 la 3
  },
  documentTitle: {
    fontSize: 14, // Redus de la 16 la 14
    color: '#374151',
    marginBottom: 3 // Redus de la 5 la 3
  },
  documentDate: {
    fontSize: 12,
    color: '#6B7280'
  },
  backgroundLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 200,
    height: 200,
    opacity: 0.05
  },
  content: {
    flex: 1,
    marginTop: 10 // Redus de la 20 la 10
  },
  section: {
    marginBottom: 12 // Redus de la 15 la 12
  },
  sectionTitle: {
    fontSize: 11, // Redus de la 14 la 11
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 6, // Redus de la 10 la 6
    paddingBottom: 3, // Redus de la 5 la 3
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3, // Redus de la 5 la 3
    paddingVertical: 1 // Redus de la 2 la 1
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    width: '40%',
    paddingRight: 10
  },
  value: {
    fontSize: 10,
    color: '#6B7280',
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 2
  },
  statusBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  statusBadgeInactive: {
    backgroundColor: '#EF4444'
  },
  statusBadgePending: {
    backgroundColor: '#F59E0B'
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signatureBox: {
    width: '45%',
    textAlign: 'center'
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 5,
    height: 40
  },
  signatureLabel: {
    fontSize: 10,
    color: '#6B7280'
  },
  footer: {
    marginTop: 15, // Redus de la 30 la 15
    paddingTop: 8, // Redus de la 15 la 8
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    textAlign: 'center'
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF'
  }
});

// Componenta PDF pentru angajat
const EmployeePDF = ({ employeeData, createdBy }) => {
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === '') return '-';
    try {
      // Verifică dacă este în formatul dd/mm/yyyy
      if (dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        if (day && month && year) {
          // Creează data în formatul corect (month este 0-indexed în JavaScript)
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          return date.toLocaleDateString('es-ES');
        }
      }
      // Încearcă să parseze ca date normală
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Returnează string-ul original dacă nu poate fi parsata
      }
      return date.toLocaleDateString('es-ES');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount.toString().trim() === '') return '-';
    try {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        return amount.toString(); // Returnează text-ul original dacă nu este un număr valid
      }
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(numericAmount);
    } catch {
      return amount ? amount.toString() : '-'; // Returnează text-ul original sau '-' în caz de eroare
    }
  };

  const getStatusBadge = (status) => {
    if (!status || status.trim() === '') return 'PENDIENTE';
    if (status === 'ACTIVO') return 'ACTIVO';
    if (status === 'INACTIVO') return 'INACTIVO';
    if (status === 'PENDIENTE') return 'PENDIENTE';
    return status.toUpperCase(); // Returnează status-ul exact dacă nu este recunoscut
  };

  const getFieldValue = (value) => {
    if (!value || value.toString().trim() === '') return '-';
    return value.toString();
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo de fundal */}
        <View style={styles.backgroundLogo}>
          <Image 
            src={logoImg} 
            style={{ 
              width: 200, 
              height: 200, 
              opacity: 0.05, 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          {/* Logo real */}
          <Image 
            src={logoImg} 
            style={styles.logo}
          />
          
          <View style={styles.headerText}>
            <Text style={styles.companyName}>DE CAMINO SERVICIOS AUXILIARES</Text>
            <Text style={styles.documentTitle}>FICHA DE EMPLEADO</Text>
            <Text style={styles.documentDate}>
              Generado el {new Date().toLocaleDateString('es-ES')} por {createdBy || 'Sistema'}
            </Text>
          </View>
        </View>

        {/* Contenido */}
        <View style={styles.content}>
          {/* Información Personal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMACIÓN PERSONAL</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>Código:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.CODIGO)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Nombre:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['NOMBRE / APELLIDOS'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['CORREO ELECTRONICO'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.TELEFONO)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>DNI/NIE:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['D.N.I. / NIE'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Nacionalidad:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.NACIONALIDAD)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Fecha Nacimiento:</Text>
              <Text style={styles.value}>{formatDate(employeeData['FECHA NACIMIENTO'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.DIRECCION)}</Text>
            </View>
          </View>

          {/* Información Laboral */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMACIÓN LABORAL</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>Empresa:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.EMPRESA)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Centro Trabajo:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['CENTRO TRABAJO'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Grupo:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData.GRUPO)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Tipo de Contrato:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['TIPO DE CONTRATO'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Horas de Contrato:</Text>
              <Text style={styles.value}>{getFieldValue(employeeData['HORAS DE CONTRATO'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Sueldo Bruto Mensual:</Text>
              <Text style={styles.value}>{formatCurrency(employeeData['SUELDO BRUTO MENSUAL'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Estado:</Text>
              <Text style={[
                styles.statusBadge, 
                employeeData.ESTADO === 'ACTIVO' ? {} : 
                employeeData.ESTADO === 'INACTIVO' ? styles.statusBadgeInactive :
                employeeData.ESTADO === 'PENDIENTE' ? styles.statusBadgePending : {}
              ]}>
                {getStatusBadge(employeeData.ESTADO)}
              </Text>
            </View>
          </View>

          {/* Fechas Importantes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FECHAS IMPORTANTES</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de Alta:</Text>
              <Text style={styles.value}>{formatDate(employeeData['FECHA DE ALTA'])}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de Baja:</Text>
              <Text style={styles.value}>{formatDate(employeeData['FECHA BAJA'])}</Text>
          </View>

          <View style={styles.row}>
              <Text style={styles.label}>Fecha Antigüedad:</Text>
              <Text style={styles.value}>{formatDate(employeeData['Fecha Antigüedad'])}</Text>
            </View>
          </View>

          {/* Información Adicional */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMACIÓN ADICIONAL</Text>
            
          <View style={styles.row}>
            <Text style={styles.label}>Seguridad Social:</Text>
            <Text style={styles.value}>{getFieldValue(employeeData['SEG. SOCIAL'])}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Nº Cuenta:</Text>
            <Text style={styles.value}>{getFieldValue(employeeData['Nº Cuenta'])}</Text>
            </View>
          </View>
        </View>

        {/* Footer compact */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 DeCamino Servicios Auxiliares - Generado automáticamente
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default EmployeePDF;
