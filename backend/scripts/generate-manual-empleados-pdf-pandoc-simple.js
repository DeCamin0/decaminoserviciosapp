const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Căi către fișiere
const manualPath = path.join(__dirname, '../../frontend/docs/MANUAL_EMPLEADOS.md');
const outputPath = path.join(__dirname, '../../MANUAL_EMPLEADOS_DECAMINO.pdf');
const coverPath = path.join(__dirname, 'pandoc-cover.tex');
const headerCoverPath = path.join(__dirname, 'pandoc-header-cover.tex');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');

// Verifică dacă fișierul manualului există
if (!fs.existsSync(manualPath)) {
  console.error('❌ Fișierul manualului nu există:', manualPath);
  process.exit(1);
}

// Verifică dacă Pandoc este instalat
let pandocFound = false;
try {
  execSync('pandoc --version', { stdio: 'ignore' });
  pandocFound = true;
} catch (error) {
  // Încearcă locații comune pentru Pandoc pe Windows
  const commonPaths = [
    'C:\\Program Files\\Pandoc\\pandoc.exe',
    'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Pandoc\\pandoc.exe'),
    path.join(process.env.APPDATA || '', 'Pandoc\\pandoc.exe')
  ];
  
  for (const pandocPath of commonPaths) {
    if (fs.existsSync(pandocPath)) {
      process.env.PATH = path.dirname(pandocPath) + path.delimiter + process.env.PATH;
      try {
        execSync(`"${pandocPath}" --version`, { stdio: 'ignore' });
        pandocFound = true;
        break;
      } catch (e) {
        // Continuă căutarea
      }
    }
  }
  
  if (!pandocFound) {
    console.error('❌ Pandoc nu este găsit în PATH!');
    console.error('💡 Repornește terminalul după instalare sau verifică PATH');
    process.exit(1);
  }
}

console.log('📝 Generando PDF con Pandoc (versión simplificada)...');
console.log(`📄 Archivo de entrada: ${manualPath}`);
console.log(`📄 Archivo de salida: ${outputPath}`);

// Verificar si existe el logo
const logoExists = fs.existsSync(logoPath);
if (logoExists) {
  console.log('✅ Logo encontrado:', logoPath);
} else {
  console.log('⚠️ Logo no encontrado, se generará sin logo');
}

// Comandă Pandoc cu portada (folosim xelatex pentru suport UTF-8 și emoji-uri)
// Opciones para mejorar la portada y el formato
// NO usamos --toc aquí porque lo incluimos manualmente en el header LaTeX
let pandocCommand = `pandoc "${manualPath}" -o "${outputPath}" --pdf-engine=xelatex --from=markdown --to=pdf --number-sections`;

// Añadir opciones de formato
pandocCommand += ` -V geometry:margin=2.5cm`;
pandocCommand += ` -V fontsize=11pt`;
pandocCommand += ` -V documentclass=article`;

// Traducir "Contents" a "Contenido" (spaniolă) - se hace en el header LaTeX
// El header LaTeX ya incluye \renewcommand{\contentsname}{Contenido}

// Si existe el archivo de header para copertă, lo incluimos (pentru pachete LaTeX)
if (fs.existsSync(headerCoverPath)) {
  pandocCommand += ` --include-in-header="${headerCoverPath}"`;
  console.log('✅ Header para copertă encontrado');
}

// Si existe el archivo de portada LaTeX, lo incluimos como body
if (fs.existsSync(coverPath)) {
  pandocCommand += ` --include-before-body="${coverPath}"`;
  console.log('✅ Portada personalizada encontrada');
} else {
  console.log('⚠️ Archivo de portada no encontrado, se usará portada del Markdown');
}

try {
  console.log('🔄 Ejecutando Pandoc...');
  console.log('💡 Nota: Si aparece un diálogo de MiKTeX, haz click en "Install" para instalar los paquetes necesarios.');
  console.log('');
  
  execSync(pandocCommand, { 
    stdio: 'inherit',
    shell: true,
    cwd: path.dirname(manualPath)
  });
  
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('');
    console.log('✅ PDF generado con éxito!');
    console.log(`📄 Archivo: ${outputPath}`);
    console.log(`📊 Tamaño: ${fileSizeMB} MB`);
  } else {
    console.error('❌ Error: El PDF no se generó correctamente');
    process.exit(1);
  }
} catch (error) {
  console.error('');
  console.error('❌ Error al generar PDF con Pandoc:');
  console.error('');
  console.error('💡 Solución:');
  console.error('   1. Cuando aparezca el diálogo de MiKTeX, haz click en "Install"');
  console.error('   2. Repite el proceso hasta que se instalen todos los paquetes necesarios');
  console.error('   3. La próxima vez no aparecerán los diálogos');
  console.error('');
  console.error('   O instala los paquetes manualmente desde MiKTeX Console');
  process.exit(1);
}
