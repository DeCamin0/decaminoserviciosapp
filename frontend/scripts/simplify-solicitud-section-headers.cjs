const fs = require('fs');
const p = 'src/pages/SolicitudesPage.jsx';
let c = fs.readFileSync(p, 'utf8');
const hadCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');
c = c.replace(
  /className="relative flex items-start sm:items-center justify-between flex-wrap gap-3 sm:gap-6 mb-6"/g,
  'className="solicitud-form__section-head"'
);
c = c.replace(
  /<div className="flex items-center">\s*<div[\s\S]*?className="w-12 h-12[\s\S]*?<\/div>\s*<h3 className="text-xl font-bold text-gray-900">\s*([\s\S]*?)\s*<\/h3>\s*<\/div>/g,
  '<h3 className="solicitud-form__section-title">$1</h3>'
);
c = c.replace(
  /<div className="relative flex items-center mb-4">\s*<div[\s\S]*?className="w-12 h-12[\s\S]*?<\/div>\s*<h3 className="text-xl font-bold text-gray-900">\s*([\s\S]*?)\s*<\/h3>\s*<\/div>/g,
  '<h3 className="solicitud-form__section-title mb-3">$1</h3>'
);
fs.writeFileSync(p, hadCRLF ? c.replace(/\n/g, '\r\n') : c);
console.log('section headers simplified');
