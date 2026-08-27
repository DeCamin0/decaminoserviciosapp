const fs = require('fs');
const p = 'src/pages/SolicitudesPage.jsx';
let c = fs.readFileSync(p, 'utf8');
const hadCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');
const before = (c.match(/backdropFilter: 'blur\(10px\)'/g) || []).length;
c = c.replace(
  /<div\s*\n\s*className="relative group[^"]*"\s*\n\s*style=\{\{[\s\S]*?backdropFilter: 'blur\(10px\)'[\s\S]*?\}\}\s*\n\s*>/g,
  '<div className="app-card app-card--pad solicitud-form__section">'
);
c = c.replace(/\s*\{\/\* Glow animado[\s\S]*?\*\/\}\s*\n\s*<div className="absolute inset-0 rounded-2xl[\s\S]*?<\/div>\s*\n/g, '\n');
const after = (c.match(/backdropFilter: 'blur\(10px\)'/g) || []).length;
fs.writeFileSync(p, hadCRLF ? c.replace(/\n/g, '\r\n') : c);
console.log(`blur sections: ${before} -> ${after}`);
