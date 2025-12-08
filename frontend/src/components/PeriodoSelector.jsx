import { useMemo } from 'react';
import { usePeriodo } from '../contexts/PeriodoContextBase';

const PeriodoSelector = () => {
  const { selection, setQuarter, setYear, periodOptions } = usePeriodo();

  const value = useMemo(() => {
    if (selection.type === 'quarter') {
      return `${selection.year}-T${selection.quarter}`;
    }
    if (selection.type === 'year') {
      return `${selection.year}`;
    }
    return 'custom';
  }, [selection]);

  const onChange = (e) => {
    const v = e.target.value;
    if (v.includes('-T')) {
      const [y, tq] = v.split('-T');
      setQuarter(Number(y), Number(tq));
    } else {
      setYear(Number(v));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Periodo</label>
      <select value={value} onChange={onChange} className="px-3 py-2 border rounded-md">
        {periodOptions.map((opt) => (
          <option key={opt.label} value={opt.label}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default PeriodoSelector;


