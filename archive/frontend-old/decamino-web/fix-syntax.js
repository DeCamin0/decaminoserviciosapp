const fs = require('fs');

// Citește fișierul
const filePath = 'src/pages/DocumentosEmpleadosPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Înlocuiește ))} cu }) la linia 4531
const lines = content.split('\n');
if (lines[4530] && lines[4530].includes(')))')) {
  lines[4530] = lines[4530].replace(')))', '})');
  console.log('✅ Am corectat eroarea de sintaxă la linia 4531');
} else {
  console.log('⚠️ Nu am găsit pattern-ul ))} la linia 4531');
}

// Scrie fișierul înapoi
fs.writeFileSync(filePath, lines.join('\n'));
console.log('✅ Fișierul a fost salvat cu modificările');
