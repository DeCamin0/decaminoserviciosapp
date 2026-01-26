const subject = 'Re: CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES';
console.log('Testing subject:', subject);

// Pattern 1b pentru baja
const pattern1b = /CARTA\s+DESPIDO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s*$)/i;
const match1b = subject.match(pattern1b);
console.log('\nPattern 1b (baja):', pattern1b);
console.log('Match 1b:', match1b ? match1b[1] : 'no match');

if (match1b) {
  const name = match1b[1].trim();
  console.log('Extracted name:', name);
  const nameWords = name.split(/\s+/).filter(w => w.length >= 2);
  console.log('Name words:', nameWords);
  console.log('Word count:', nameWords.length);
  console.log('Valid (2-5 words)?', nameWords.length >= 2 && nameWords.length <= 5);
  console.log('Is address?', /^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(name));
  console.log('Final valid?', nameWords.length >= 2 && nameWords.length <= 5 && !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(name));
}

// Test pattern-ul pentru imagini
const pattern4b = /CARTA\s+DESPIDO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s*$)/i;
const match4b = subject.match(pattern4b);
console.log('\nPattern 4b (image):', pattern4b);
console.log('Match 4b:', match4b ? match4b[1] : 'no match');
