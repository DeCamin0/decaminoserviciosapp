import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image
} from '@react-pdf/renderer';
import type { DetalleEmpleado } from './HorasTrabajadas';
import logoImg from '@/assets/logo.svg';

// Stiluri pentru PDF - optimizate pentru detaliile de ore
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20,
    fontFamily: 'Helvetica',
    position: 'relative',
    minHeight: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626'
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15
  },
  headerText: {
    flex: 1
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
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 3
  },
  companySubtitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 3
  },
  companyInfo: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
    lineHeight: 1.4
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 10,
    textAlign: 'center'
  },
  employeeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8
  },
  employeeLeft: {
    flex: 1
  },
  employeeRight: {
    flex: 1,
    alignItems: 'flex-end'
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5
  },
  employeeId: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 3
  },
  period: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 3
  },
  hoursSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 5,
    textAlign: 'center'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center'
  },
  table: {
    marginBottom: 15,
    flexGrow: 1
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    padding: 6,
    alignItems: 'center'
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 2
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 4,
    alignItems: 'center'
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2
  },
  tableCellLeft: {
    fontSize: 8,
    color: '#374151',
    textAlign: 'left',
    paddingVertical: 3,
    paddingHorizontal: 2
  },
  tipoEntrada: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#059669',
    backgroundColor: '#D1FAE5',
    padding: 2,
    borderRadius: 4,
    textAlign: 'center'
  },
  tipoSalida: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    padding: 2,
    borderRadius: 4,
    textAlign: 'center'
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9CA3AF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  footerLeft: {
    flex: 1
  },
  footerRight: {
    flex: 1,
    textAlign: 'right'
  }
});

// Logo-ul se importă direct din assets


// Componenta PDF pentru detaliile de ore
const HorasTrabajadasPDF = ({ 
  detalle, 
  tipoReporte,
  tabActivo = 'registros' 
}: { 
  detalle: DetalleEmpleado, 
  tipoReporte?: 'mensual' | 'anual',
  tabActivo?: 'registros' | 'detalles'
}) => {
  // Determină ce să afișeze în perioadă
  const periodoText = tipoReporte === 'anual' 
    ? detalle.mes.split('-')[0] // Doar anul pentru rapoarte anuale
    : detalle.mes; // Luna completă pentru rapoarte mensuale

  // Verifică dacă trebuie să generăm PDF pentru tab-ul "detalles"
  const esDetallesTab = tabActivo === 'detalles';

  return (
    <Document>
    <Page size="A4" style={styles.page} wrap={false}>
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

      {/* Header cu logo real și informații companie */}
      <View style={styles.header}>
        {/* Logo real */}
        <Image 
          src={logoImg} 
          style={styles.logo}
        />
        
        <View style={styles.headerText}>
          <Text style={styles.companyName}>DE CAMINO SERVICIOS AUXILIARES</Text>
          <Text style={styles.companySubtitle}>
            {esDetallesTab ? 'DETALLE DE HORAS - PLAN VS FICHADO' : 'DETALLE DE HORAS TRABAJADAS'}
          </Text>
          <Text style={styles.companyInfo}>
            Generado el {new Date().toLocaleDateString('es-ES')} por Sistema
          </Text>
        </View>
      </View>


      {/* Informații angajat */}
      <View style={styles.employeeInfo}>
        <View style={styles.employeeLeft}>
          <Text style={styles.employeeName}>{detalle.empleadoNombre}</Text>
          <Text style={styles.employeeId}>ID: {detalle.empleadoId}</Text>
          <Text style={styles.period}>Período: {periodoText}</Text>
        </View>
        <View style={styles.employeeRight}>
          <Text style={styles.employeeId}>Fecha de generación:</Text>
          <Text style={styles.period}>{new Date().toLocaleDateString('es-ES')}</Text>
        </View>
      </View>

      {/* Rezumat ore - diferit în funcție de tab */}
      {esDetallesTab ? (
        // Rezumat pentru tab-ul "Detalles"
        <View style={styles.hoursSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Trabajadas</Text>
            <Text style={styles.summaryValue}>{detalle.totalTrabajadas !== undefined ? detalle.totalTrabajadas.toFixed(1) : detalle.horasTrabajadas.toFixed(1)}h</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Plan</Text>
            <Text style={styles.summaryValue}>{detalle.totalPlan !== undefined ? detalle.totalPlan.toFixed(1) : detalle.horasContrato.toFixed(1)}h</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Permitidas</Text>
            <Text style={styles.summaryValue}>{detalle.totalPermitidas !== undefined ? detalle.totalPermitidas.toFixed(1) : '0'}h</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Estado Plan</Text>
            <Text style={[styles.summaryValue, { 
              color: detalle.estadoPlan === 'OK' ? '#059669' : (detalle.estadoPlan === 'ALERTA' ? '#F59E0B' : '#DC2626')
            }]}>
              {detalle.estadoPlan || 'OK'}
            </Text>
          </View>
        </View>
      ) : (
        // Rezumat pentru tab-ul "Registros"
        <View style={styles.hoursSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Horas Trabajadas</Text>
            <Text style={styles.summaryValue}>{detalle.horasTrabajadas.toFixed(1)}h</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Horas Contrato</Text>
            <Text style={styles.summaryValue}>{detalle.horasContrato.toFixed(1)}h</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Horas Extra</Text>
            <Text style={[styles.summaryValue, { color: detalle.horasExtra > 0 ? '#059669' : '#DC2626' }]}>
              {detalle.horasExtra > 0 ? '+' : ''}{detalle.horasExtra.toFixed(1)}h
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Media Semanal</Text>
            <Text style={styles.summaryValue}>{detalle.mediaSemanalAnual.toFixed(1)}h/sem</Text>
          </View>
        </View>
      )}

      {/* Tabel - diferit în funcție de tab */}
      {esDetallesTab ? (
        // Tabel pentru tab-ul "Detalles" - detalii_zilnice
        detalle.detaliiZilnice && detalle.detaliiZilnice.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Fecha</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Plan</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Fuente</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Fichado</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Delta</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Incompleto</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Ordinarias</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Excedente</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Estado</Text>
            </View>
            {detalle.detaliiZilnice.map((detalleDia, index) => {
              const plan = detalleDia.plan || 0;
              const fichado = detalleDia.fichado || 0;
              const delta = detalleDia.delta || 0;
              const estadoText = (plan > 0 && fichado === 0) ? 'Sin fichar' : '—';
              
              return (
                <View key={`${detalleDia.fecha}-${index}`} style={styles.tableRow}>
                  <Text style={[styles.tableCellLeft, { flex: 1 }]}>
                    {new Date(detalleDia.fecha).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>
                    {plan.toFixed(1)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, fontSize: 7 }]}>
                    {detalleDia.plan_fuente || 'N/A'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>
                    {fichado.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { 
                    flex: 0.8,
                    color: delta < 0 ? '#DC2626' : (delta > 0 ? '#059669' : '#6B7280')
                  }]}>
                    {delta.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.7 }]}>
                    {detalleDia.incompleto ? 'Sí' : 'No'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>
                    {detalleDia.ordinarias || 0}
                  </Text>
                  <Text style={[styles.tableCell, { 
                    flex: 0.8,
                    color: (detalleDia.excedente || 0) > 0 ? '#F59E0B' : '#6B7280'
                  }]}>
                    {(detalleDia.excedente || 0).toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { 
                    flex: 0.9,
                    color: estadoText === 'Sin fichar' ? '#DC2626' : '#6B7280',
                    fontSize: estadoText === 'Sin fichar' ? 7 : 8,
                    fontWeight: estadoText === 'Sin fichar' ? 'bold' : 'normal'
                  }]}>
                    {estadoText}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ padding: 20, textAlign: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>No hay datos de detalle disponibles</Text>
          </View>
        )
      ) : (
        // Tabel pentru tab-ul "Registros" - registrele zilnice
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Fecha</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Hora</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Tipo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Duración</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Dirección</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Estado</Text>
          </View>
          {detalle.dias.map((dia, index) => {
            let estadoText = '—';
            if (detalle.detaliiZilnice && detalle.detaliiZilnice.length > 0) {
              const detalleDia = detalle.detaliiZilnice.find(d => d.fecha === dia.fecha);
              if (detalleDia) {
                const plan = detalleDia.plan || 0;
                const fichado = detalleDia.fichado || 0;
                if (plan > 0 && fichado === 0) {
                  estadoText = 'Sin fichar';
                }
              }
            }
            
            return (
              <View key={`${dia.fecha}-${index}`} style={styles.tableRow}>
                <Text style={[styles.tableCellLeft, { flex: 1.2 }]}>
                  {new Date(dia.fecha).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.9 }]}>
                  {dia.tipo === 'Entrada' ? dia.entrada : dia.salida}
                </Text>
                <View style={[styles.tableCell, { flex: 0.9 }]}>
                  <Text style={dia.tipo === 'Entrada' ? styles.tipoEntrada : styles.tipoSalida}>
                    {dia.tipo}
                  </Text>
                </View>
                <Text style={[styles.tableCell, { flex: 0.9 }]}>
                  {dia.duracion || '--:--'}
                </Text>
                <Text style={[styles.tableCellLeft, { flex: 2.2, fontSize: 7 }]}>
                  {dia.direccion && dia.direccion.length > 50 ? `${dia.direccion.substring(0, 50)}...` : dia.direccion}
                </Text>
                <Text style={[styles.tableCell, { 
                  flex: 0.9,
                  color: estadoText === 'Sin fichar' ? '#DC2626' : '#6B7280',
                  fontSize: estadoText === 'Sin fichar' ? 7 : 8,
                  fontWeight: estadoText === 'Sin fichar' ? 'bold' : 'normal'
                }]}>
                  {estadoText}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text>DE CAMINO SERVICIOS AUXILIARES SL</Text>
          <Text>CIF B-85524536 - Inscrita en R.M. Madrid</Text>
        </View>
        <View style={styles.footerRight}>
          <Text>Generado el {new Date().toLocaleDateString('es-ES')}</Text>
          <Text>
            {esDetallesTab 
              ? `Total de días: ${detalle.detaliiZilnice?.length || 0}` 
              : `Total de registros: ${detalle.dias.length}`
            }
          </Text>
        </View>
      </View>
    </Page>
    </Document>
  );
};

export default HorasTrabajadasPDF;
