const text = `EL/LA TRABAJADOR/A
Don/D.:
D.N.I. Domicilio	Fecha de nacimiento
GRANADO DIUNIS ROSALES 281668310515
01/01/1990 55870533Z CL`;

const pattern8 = /el\/la\s+trabajador\/a\s*don\/d\.?:?\s*\n(?:[^\n]*\n)*?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3})\s+\d/i;
const pattern9 = /don\/d\.?:?\s*\n(?:[^\n]*\n)*?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3})\s+\d/i;

console.log('Testing Pattern 8:');
const match8 = text.match(pattern8);
console.log('Match 8:', match8 ? match8[1] : 'no match');

console.log('\nTesting Pattern 9:');
const match9 = text.match(pattern9);
console.log('Match 9:', match9 ? match9[1] : 'no match');
