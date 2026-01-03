import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContextBase';
import { BASE_URL } from '../../utils/routes';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

type EmpleadoStats = {
  codigo: string;
  nombre: string;
  email: string | null;
  centro: string | null;
  grupo: string | null;
  estado: string | null;
  loginCount: number;
  fichajesCount: number;
  lastLogin: string | null;
  lastFichaje: string | null;
};

type SortField = 'codigo' | 'nombre' | 'centro' | 'grupo' | 'estado' | 'loginCount' | 'fichajesCount' | 'lastLogin' | 'lastFichaje' | null;
type SortDirection = 'asc' | 'desc' | null;
type GroupField = 'estado' | 'grupo' | 'centro' | null;

export default function EmpleadosStatusList() {
  const { authToken, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<EmpleadoStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [groupField, setGroupField] = useState<GroupField>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        const url = `${BASE_URL}/api/empleados/stats`;

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken ? `Bearer ${authToken}` : '',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Error al cargar estadísticas: ${res.status} ${text}`,
          );
        }

        const data = await res.json();

        setStats(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('[EmpleadosStatusList] Error fetching stats:', err);
        setError(err.message || 'Error desconocido al cargar estadísticas');
      } finally {
        setLoading(false);
      }
    }

    if (authToken) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateForExport = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString || '-';
    }
  };

  // Funcție pentru sortare
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Dacă e deja sortat după acest câmp, schimbă direcția
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        // Dacă e desc, resetează sortarea
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      // Sortare nouă, începe cu asc
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Funcție pentru grupare (toggle)
  const handleGroup = (field: GroupField) => {
    if (groupField === field) {
      // Dacă e deja grupat după acest câmp, dezactivează gruparea
      setGroupField(null);
    } else {
      // Activează gruparea după acest câmp
      setGroupField(field);
    }
  };

  // Sortare și grupare date
  const sortedAndGroupedStats = useMemo(() => {
    let result = [...stats];

    // Aplică sortarea
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        // Tratează null/undefined
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        // Conversie pentru numere
        if (sortField === 'loginCount' || sortField === 'fichajesCount') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        }

        // Conversie pentru date
        if (sortField === 'lastLogin' || sortField === 'lastFichaje') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        // Conversie pentru string-uri
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
        }
        if (typeof bValue === 'string') {
          bValue = bValue.toLowerCase();
        }

        // Comparare
        if (aValue < bValue) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Aplică gruparea
    if (groupField) {
      const grouped = new Map<string, EmpleadoStats[]>();
      
      result.forEach((empleado) => {
        const groupKey = empleado[groupField] || 'Sin ' + groupField;
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(empleado);
      });

      // Convertește Map-ul în array de grupuri sortate
      const groups = Array.from(grouped.entries()).sort((a, b) => {
        return a[0].localeCompare(b[0]);
      });

      // Returnează array-ul cu grupuri
      return groups.flatMap(([groupName, empleados]) => {
        // Adaugă un rând de header pentru grup (va fi tratat special în render)
        return [{ __isGroupHeader: true, __groupName: groupName, __groupCount: empleados.length } as any, ...empleados];
      });
    }

    return result;
  }, [stats, sortField, sortDirection, groupField]);

  // Helper pentru a obține iconul de sortare
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return '⇅'; // Icon pentru nesortat
    }
    if (sortDirection === 'asc') {
      return '↑'; // Ascendent
    }
    if (sortDirection === 'desc') {
      return '↓'; // Descendent
    }
    return '⇅';
  };

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Estado Empleados');

      // Stiluri
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDC2626' }, // Red-600
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        },
      };

      // Headers
      worksheet.columns = [
        { header: 'CÓDIGO', key: 'codigo', width: 15 },
        { header: 'EMPLEADO', key: 'nombre', width: 30 },
        { header: 'CENTRO', key: 'centro', width: 40 },
        { header: 'GRUPO', key: 'grupo', width: 25 },
        { header: 'ESTADO', key: 'estado', width: 15 },
        { header: 'LOGINS', key: 'loginCount', width: 12 },
        { header: 'FICHAJES', key: 'fichajesCount', width: 12 },
        { header: 'ÚLTIMO LOGIN', key: 'lastLogin', width: 20 },
        { header: 'ÚLTIMO FICHAJE', key: 'lastFichaje', width: 20 },
      ];

      // Aplică stil la header
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Adaugă datele (folosește datele sortate/grupate, dar fără header-ele de grup)
      sortedAndGroupedStats.forEach((item: any) => {
        if (item.__isGroupHeader) {
          // Adaugă un rând de separator pentru grup în Excel
          worksheet.addRow({
            codigo: `📁 ${item.__groupName} (${item.__groupCount} empleado${item.__groupCount !== 1 ? 's' : ''})`,
            nombre: '',
            centro: '',
            grupo: '',
            estado: '',
            loginCount: '',
            fichajesCount: '',
            lastLogin: '',
            lastFichaje: '',
          });
        } else {
          const empleado = item as EmpleadoStats;
          worksheet.addRow({
            codigo: empleado.codigo,
            nombre: empleado.nombre,
            centro: empleado.centro || '-',
            grupo: empleado.grupo || '-',
            estado: empleado.estado || '-',
            loginCount: empleado.loginCount,
            fichajesCount: empleado.fichajesCount,
            lastLogin: formatDateForExport(empleado.lastLogin),
            lastFichaje: formatDateForExport(empleado.lastFichaje),
          });
        }
      });

      // Aplică borduri la toate celulele
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      // Generează buffer și descarcă
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Estado_Empleados_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error al exportar a Excel');
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const tableStartY = 20;
      let currentY = tableStartY;

      // Título
      doc.setFontSize(18);
      doc.setTextColor(220, 38, 38); // Red-600
      doc.text('Estado Empleados', margin, 15);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Generado: ${new Date().toLocaleDateString('es-ES')} - Total: ${stats.length} empleados`,
        margin,
        22,
      );

      currentY = 28;

      // Headers
      const headers = [
        'CÓDIGO',
        'EMPLEADO',
        'CENTRO',
        'GRUPO',
        'ESTADO',
        'LOGINS',
        'FICHAJES',
        'ÚLTIMO LOGIN',
        'ÚLTIMO FICHAJE',
      ];

      const colWidths = [
        20, 35, 45, 25, 20, 15, 15, 25, 25,
      ];

      let xPos = margin;

      // Desenează header
      doc.setFillColor(220, 38, 38); // Red-600
      doc.rect(xPos, currentY, pageWidth - 2 * margin, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');

      headers.forEach((header, index) => {
        doc.text(header, xPos + 2, currentY + 5);
        xPos += colWidths[index];
      });

      currentY += 8;
      xPos = margin;

      // Desenează datele (folosește datele sortate/grupate)
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      let rowIndex = 0;
      sortedAndGroupedStats.forEach((item: any) => {
        // Verifică dacă mai avem spațiu pe pagină
        if (currentY > pageHeight - 20) {
          doc.addPage();
          currentY = margin;
        }

        // Verifică dacă este un header de grup
        if (item.__isGroupHeader) {
          // Desenează header de grup
          doc.setFillColor(59, 130, 246); // Blue-500
          doc.rect(xPos, currentY, pageWidth - 2 * margin, 7, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`📁 ${item.__groupName} (${item.__groupCount} empleado${item.__groupCount !== 1 ? 's' : ''})`, xPos + 2, currentY + 5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          currentY += 7;
          xPos = margin;
          return;
        }

        // Rând normal de date
        const empleado = item as EmpleadoStats;

        // Alternă culoarea fundalului
        if (rowIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251); // Gray-50
          doc.rect(xPos, currentY, pageWidth - 2 * margin, 6, 'F');
        }

        xPos = margin;
        const rowData = [
          empleado.codigo,
          empleado.nombre.substring(0, 25),
          (empleado.centro || '-').substring(0, 30),
          empleado.grupo || '-',
          empleado.estado || '-',
          empleado.loginCount.toString(),
          empleado.fichajesCount.toString(),
          formatDateForExport(empleado.lastLogin).substring(0, 15),
          formatDateForExport(empleado.lastFichaje).substring(0, 15),
        ];

        rowData.forEach((cell, cellIndex) => {
          doc.text(cell, xPos + 2, currentY + 4);
          xPos += colWidths[cellIndex];
        });

        // Borduri
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, currentY, pageWidth - 2 * margin, 6);

        currentY += 6;
        xPos = margin;
        rowIndex++;
      });

      // Descarcă PDF
      doc.save(`Estado_Empleados_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error al exportar a PDF');
    }
  };

  if (!isAuthenticated || !authToken) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <p className="text-sm text-gray-600">
          Debes iniciar sesión para ver el estado de los empleados.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
        <p className="text-sm text-gray-600">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-2">⚠️</div>
          <p className="text-red-600 font-semibold mb-2">Error</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Estado Empleados
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Estadísticas de actividad de todos los empleados.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <div className="text-3xl font-bold text-red-600">
              {stats.length}
            </div>
            <div className="text-sm text-gray-600">empleados</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              disabled={stats.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span>📊</span>
              Exportar Excel
            </button>
            <button
              onClick={exportToPDF}
              disabled={stats.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span>📄</span>
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('codigo')}
                title="Click para ordenar por CÓDIGO"
              >
                <div className="flex items-center gap-1">
                  CÓDIGO
                  <span className="text-gray-400 text-xs">{getSortIcon('codigo')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('nombre')}
                title="Click para ordenar por EMPLEADO"
              >
                <div className="flex items-center gap-1">
                  EMPLEADO
                  <span className="text-gray-400 text-xs">{getSortIcon('nombre')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => {
                  handleSort('centro');
                  handleGroup('centro');
                }}
                title="Click para ordenar y agrupar por CENTRO"
              >
                <div className="flex items-center gap-1">
                  CENTRO
                  <span className="text-gray-400 text-xs">{getSortIcon('centro')}</span>
                  {groupField === 'centro' && <span className="text-blue-500 text-xs" title="Agrupado">📁</span>}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => {
                  handleSort('grupo');
                  handleGroup('grupo');
                }}
                title="Click para ordenar y agrupar por GRUPO"
              >
                <div className="flex items-center gap-1">
                  GRUPO
                  <span className="text-gray-400 text-xs">{getSortIcon('grupo')}</span>
                  {groupField === 'grupo' && <span className="text-blue-500 text-xs" title="Agrupado">📁</span>}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => {
                  handleSort('estado');
                  handleGroup('estado');
                }}
                title="Click para ordenar y agrupar por ESTADO"
              >
                <div className="flex items-center gap-1">
                  ESTADO
                  <span className="text-gray-400 text-xs">{getSortIcon('estado')}</span>
                  {groupField === 'estado' && <span className="text-blue-500 text-xs" title="Agrupado">📁</span>}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('loginCount')}
                title="Click para ordenar por LOGINS"
              >
                <div className="flex items-center justify-center gap-1">
                  LOGINS
                  <span className="text-gray-400 text-xs">{getSortIcon('loginCount')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('fichajesCount')}
                title="Click para ordenar por FICHAJES"
              >
                <div className="flex items-center justify-center gap-1">
                  FICHAJES
                  <span className="text-gray-400 text-xs">{getSortIcon('fichajesCount')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('lastLogin')}
                title="Click para ordenar por ÚLTIMO LOGIN"
              >
                <div className="flex items-center gap-1">
                  ÚLTIMO LOGIN
                  <span className="text-gray-400 text-xs">{getSortIcon('lastLogin')}</span>
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('lastFichaje')}
                title="Click para ordenar por ÚLTIMO FICHAJE"
              >
                <div className="flex items-center gap-1">
                  ÚLTIMO FICHAJE
                  <span className="text-gray-400 text-xs">{getSortIcon('lastFichaje')}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stats.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              sortedAndGroupedStats.map((item: any, index: number) => {
                // Verifică dacă este un header de grup
                if (item.__isGroupHeader) {
                  return (
                    <tr key={`group-${item.__groupName}-${index}`} className="bg-blue-50 border-t-2 border-blue-200">
                      <td colSpan={9} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-bold text-sm">📁 {item.__groupName}</span>
                          <span className="text-blue-500 text-xs">({item.__groupCount} empleado{item.__groupCount !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Rând normal de date
                const empleado = item as EmpleadoStats;
                return (
                  <tr
                    key={empleado.codigo}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {empleado.codigo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {empleado.nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {empleado.centro || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {empleado.grupo || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          empleado.estado === 'ACTIVO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {empleado.estado || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {empleado.loginCount}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {empleado.fichajesCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(empleado.lastLogin)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(empleado.lastFichaje)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

