const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Elimină spații, puncte și cratime; majuscule. */
export function normalizeSpanishDniNie(value) {
  return String(value || '').replace(/[\s.-]/g, '').toUpperCase();
}

/**
 * Validează DNI spaniol (8 cifre + literă) sau NIE (X/Y/Z + 7 cifre + literă),
 * inclusiv litera de control.
 */
export function isValidSpanishDniNie(value) {
  const id = normalizeSpanishDniNie(value);
  if (!id) return false;

  let numberPart;
  let letter;

  if (/^[0-9]{8}[A-Z]$/.test(id)) {
    numberPart = parseInt(id.slice(0, 8), 10);
    letter = id[8];
  } else if (/^[XYZ][0-9]{7}[A-Z]$/.test(id)) {
    const prefix = { X: '0', Y: '1', Z: '2' }[id[0]];
    numberPart = parseInt(prefix + id.slice(1, 8), 10);
    letter = id[8];
  } else {
    return false;
  }

  if (Number.isNaN(numberPart)) return false;
  return DNI_LETTERS[numberPart % 23] === letter;
}

/** null = gol, true = valid, false = invalid (ca la EmpleadosPage / DatosPage). */
export function validarDniNie(documento) {
  if (!documento || String(documento).trim() === '') return null;
  return isValidSpanishDniNie(documento);
}
