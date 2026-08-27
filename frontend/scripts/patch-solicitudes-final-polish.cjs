/**
 * Final polish — admin zones only (line >= ADMIN_START), skip employee lista/nueva.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/pages/SolicitudesPage.jsx');
const ADMIN_START = 10246;

let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

function inAdmin(i) {
  return i + 1 >= ADMIN_START;
}

const GRADIENT_BTN = {
  blue: 'solicitud-admin-btn solicitud-admin-btn--primary text-sm whitespace-nowrap',
  green: 'solicitud-admin-btn solicitud-admin-btn--success text-sm whitespace-nowrap',
  orange: 'solicitud-admin-btn solicitud-admin-btn--warn text-sm whitespace-nowrap',
  purple: 'solicitud-admin-btn solicitud-admin-btn--primary text-sm whitespace-nowrap',
  gray: 'solicitud-admin-btn text-sm whitespace-nowrap',
  red: 'solicitud-admin-btn solicitud-admin-btn--danger text-sm whitespace-nowrap',
};

for (let i = 0; i < lines.length; i++) {
  if (!inAdmin(i)) continue;
  let line = lines[i];

  // Gradient CTA buttons
  if (line.includes('bg-gradient-to-r from-blue-500 to-blue-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-blue-500[^"]*"/, `className="${GRADIENT_BTN.blue}"`);
    line = line.replace(/className=\{`[^`]*bg-gradient-to-r from-blue-500[^`]*`\}/, `className="${GRADIENT_BTN.blue}"`);
  }
  if (line.includes('bg-gradient-to-r from-green-500 to-green-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-green-500[^"]*"/, `className="${GRADIENT_BTN.green}"`);
    line = line.replace(/className=\{`[^`]*bg-gradient-to-r from-green-500[^`]*`\}/, `className="${GRADIENT_BTN.green}"`);
  }
  if (line.includes('bg-gradient-to-r from-orange-500 to-orange-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-orange-500[^"]*"/, `className="${GRADIENT_BTN.orange}"`);
    line = line.replace(/className=\{`[^`]*bg-gradient-to-r from-orange-500[^`]*`\}/, `className="${GRADIENT_BTN.orange}"`);
  }
  if (line.includes('bg-gradient-to-r from-purple-500 to-purple-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-purple-500[^"]*"/, `className="${GRADIENT_BTN.purple}"`);
  }
  if (line.includes('bg-gradient-to-r from-gray-500 to-gray-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-gray-500[^"]*"/, `className="${GRADIENT_BTN.gray}"`);
  }
  if (line.includes('bg-gradient-to-r from-red-500 to-red-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-red-500[^"]*"/, `className="${GRADIENT_BTN.red}"`);
  }
  if (line.includes('bg-gradient-to-r from-yellow-500 to-yellow-600')) {
    line = line.replace(/className="[^"]*bg-gradient-to-r from-yellow-500[^"]*"/, `className="${GRADIENT_BTN.orange}"`);
  }
  if (line.includes('bg-gradient-to-r from-rose-500 to-rose-600')) {
    line = line.replace(/bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700/, 'solicitud-admin-btn solicitud-admin-btn--primary');
  }

  // Callout boxes
  if (line.includes('bg-gradient-to-r from-yellow-50 to-orange-50')) {
    line = line.replace(
      'mt-4 p-4 rounded-lg border-2 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200',
      'solicitud-admin-callout mt-4 border-amber-200'
    );
  }
  if (line.includes('bg-gradient-to-r from-rose-50 to-pink-50')) {
    line = line.replace(/bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200[^`]*shadow-lg/, 'app-card app-card--pad border-rose-200');
  }
  if (line.includes('bg-gradient-to-br from-slate-50 to-white')) {
    line = line.replace(
      'rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden',
      'solicitud-admin-section'
    );
  }
  if (line.includes('bg-gradient-to-br from-violet-50/90 to-white')) {
    line = line.replace(
      'rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white shadow-sm overflow-hidden',
      'solicitud-admin-section'
    );
  }
  if (line.includes('bg-gradient-to-r from-red-50 to-pink-50')) {
    line = line.replace(
      'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4',
      'app-card app-card--pad border-red-200'
    );
  }

  // Purple estadísticas inputs
  if (line.includes('border-purple-300') && line.includes('focus:ring-purple-500')) {
    line = line.replace(
      /className=\{`\$\{isMobile \? 'w-12[^`]+`\}/,
      'className="app-modal__input w-20 text-center text-sm"'
    );
  }

  // Purple table headers in estadísticas
  line = line.replace(/border-l-2 border-purple-400/g, 'border-l border-gray-200');

  // Detail grid cells — simplify colored boxes
  line = line.replace(
    /className="bg-(blue|green|rose|purple|gray)-50 p-4 rounded-lg[^"]*"/g,
    'className="app-card app-card--pad"'
  );
  line = line.replace(
    /className="bg-white p-4 rounded-lg border border-gray-200[^"]*"/g,
    'className="app-card app-card--pad"'
  );

  lines[i] = line;
}

src = lines.join('\n');

// Multi-line template for convertir/approve toggle button
src = src.replace(
  /className=\{`group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg \$\{\s*esJustificada\s*\?\s*'bg-gradient-to-r from-red-500 to-red-600 text-white'\s*:\s*'bg-gradient-to-r from-green-500 to-green-600 text-white'\s*\}`\}/g,
  "className={`solicitud-admin-btn text-sm ${esJustificada ? 'solicitud-admin-btn--danger' : 'solicitud-admin-btn--success'}`}"
);

fs.writeFileSync(FILE, src, 'utf8');
console.log('patch-solicitudes-final-polish.cjs done');
