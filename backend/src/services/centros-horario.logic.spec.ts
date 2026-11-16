import { blocksOverlap, mergeCentroHorarios } from './centros-horario.logic';

describe('mergeCentroHorarios', () => {
  it('dimineața la un centru și după-amiaza la altul se adună', () => {
    const merged = mergeCentroHorarios([
      {
        centro: 'Timbales',
        intervals: [{ horaIn: '08:00', horaOut: '12:00' }],
      },
      { centro: 'Señorío', intervals: [{ horaIn: '15:00', horaOut: '19:00' }] },
    ]);
    expect(merged.conflict).toBe(false);
    expect(merged.intervals.map((item) => item.centro)).toEqual([
      'Timbales',
      'Señorío',
    ]);
  });

  it('aceleași ore la două centre sunt conflict, nu două ture', () => {
    const merged = mergeCentroHorarios([
      {
        centro: 'Timbales',
        intervals: [{ horaIn: '08:00', horaOut: '15:00' }],
      },
      { centro: 'Señorío', intervals: [{ horaIn: '08:00', horaOut: '15:00' }] },
    ]);
    expect(merged.conflict).toBe(true);
    expect(merged.intervals).toEqual([]);
  });

  it('două intervale ale aceluiași centru nu sunt conflict', () => {
    const merged = mergeCentroHorarios([
      {
        centro: 'Timbales',
        intervals: [
          { horaIn: '08:00', horaOut: '12:00' },
          { horaIn: '12:00', horaOut: '14:00' },
        ],
      },
    ]);
    expect(merged.conflict).toBe(false);
    expect(merged.intervals).toHaveLength(2);
  });

  it('capătul comun nu se calcă', () => {
    expect(
      blocksOverlap(
        { horaIn: '08:00', horaOut: '12:00' },
        { horaIn: '12:00', horaOut: '16:00' },
      ),
    ).toBe(false);
  });
});
