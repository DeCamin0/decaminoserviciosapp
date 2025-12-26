import { useMemo } from 'react';
import { usePeriodo } from '../contexts/PeriodoContextBase';

const MonthSelector = ({ onMonthSelect, selectedMonth }) => {
  const { selection } = usePeriodo();

  const monthOptions = useMemo(() => {
    const months = [
      { value: 0, label: 'Todas las meses' },
      { value: 1, label: 'Enero' },
      { value: 2, label: 'Febrero' },
      { value: 3, label: 'Marzo' },
      { value: 4, label: 'Abril' },
      { value: 5, label: 'Mayo' },
      { value: 6, label: 'Junio' },
      { value: 7, label: 'Julio' },
      { value: 8, label: 'Agosto' },
      { value: 9, label: 'Septiembre' },
      { value: 10, label: 'Octubre' },
      { value: 11, label: 'Noviembre' },
      { value: 12, label: 'Diciembre' }
    ];

    // If a quarter is selected, filter to show only months from that quarter
    if (selection.type === 'quarter') {
      const startMonth = (selection.quarter - 1) * 3; // 0, 3, 6, 9
      const quarterMonths = months.filter(month => 
        month.value === 0 || (month.value >= startMonth + 1 && month.value <= startMonth + 3)
      );
      return quarterMonths;
    }

    // If a year is selected, show all months
    return months;
  }, [selection]);

  const handleChange = (e) => {
    const monthValue = parseInt(e.target.value, 10);
    onMonthSelect(monthValue);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Mes</label>
      <select 
        value={selectedMonth || 0} 
        onChange={handleChange} 
        className="px-3 py-2 border rounded-md"
      >
        {monthOptions.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MonthSelector;
