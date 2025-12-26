import { useEffect, useMemo, useState } from 'react';
import { PeriodoContext } from './PeriodoContextBase';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getQuarterRange(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);
  const startMonth = (q - 1) * 3; // 0,3,6,9
  const from = startOfDay(new Date(y, startMonth, 1));
  const to = endOfDay(new Date(y, startMonth + 3, 0)); // last day of quarter
  return { from, to };
}

function getYearRange(year) {
  const y = Number(year);
  const from = startOfDay(new Date(y, 0, 1));
  const to = endOfDay(new Date(y, 12, 0));
  return { from, to };
}

function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return { year, quarter };
}

function buildOptions(yearsBack = 4, yearsForward = 0) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const options = [];
  for (let y = currentYear + yearsForward; y >= currentYear - yearsBack; y -= 1) {
    // Quarters Q4..Q1
    for (let q = 4; q >= 1; q -= 1) {
      const label = `${y}-T${q}`;
      options.push({ type: 'quarter', label, value: { year: y, quarter: q } });
    }
    options.push({ type: 'year', label: `${y}`, value: { year: y } });
  }
  return options;
}

export const PeriodoProvider = ({ children }) => {
  const current = getCurrentQuarter();
  const [selection, setSelection] = useState(() => {
    const saved = localStorage.getItem('periodo.selection');
    if (saved) {
      try { return JSON.parse(saved); } catch {
        // Ignore JSON parsing errors
      }
    }
    return { type: 'quarter', year: current.year, quarter: current.quarter };
  });

  useEffect(() => {
    localStorage.setItem('periodo.selection', JSON.stringify(selection));
  }, [selection]);

  const { from, to } = useMemo(() => {
    if (selection.type === 'year') {
      return getYearRange(selection.year);
    }
    if (selection.type === 'custom') {
      return { from: startOfDay(selection.from), to: endOfDay(selection.to) };
    }
    return getQuarterRange(selection.year, selection.quarter);
  }, [selection]);

  const periodOptions = useMemo(() => buildOptions(6, 0), []);

  const value = {
    selection,
    from,
    to,
    periodOptions,
    setQuarter: (year, quarter) => setSelection({ type: 'quarter', year, quarter }),
    setYear: (year) => setSelection({ type: 'year', year }),
    setCustom: (fromDate, toDate) => setSelection({ type: 'custom', from: fromDate, to: toDate }),
    setSelection,
  };

  return (
    <PeriodoContext.Provider value={value}>{children}</PeriodoContext.Provider>
  );
};


