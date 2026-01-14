const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Căi către fișiere
const manualPath = path.join(__dirname, '../../frontend/docs/MANUAL_EMPLEADOS.md');
const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
const outputPath = path.join(__dirname, '../../MANUAL_EMPLEADOS_DECAMINO.pdf');

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
      // Adaugă Pandoc la PATH pentru această sesiune
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
    console.error('');
    console.error('💡 Soluții:');
    console.error('   1. Repornește terminalul după instalare');
    console.error('   2. Verifică că Pandoc este în PATH');
    console.error('   3. Rulează manual: pandoc --version');
    console.error('');
    console.error('📥 Dacă nu este instalat:');
    console.error('   Windows: https://pandoc.org/installing.html');
    console.error('   sau: winget install JohnMacFarlane.Pandoc');
    process.exit(1);
  }
}

console.log('📝 Generando PDF con Pandoc...');
console.log(`📄 Archivo de entrada: ${manualPath}`);
console.log(`📄 Archivo de salida: ${outputPath}`);

// Construiește comanda Pandoc (folosind array pentru a evita probleme cu spațiile)
const pandocArgs = [
  `"${manualPath}"`,
  '-o', `"${outputPath}"`,
  // Folosim pdflatex (mai simplu, mai puține dependențe)
  '--pdf-engine=pdflatex',
  '--from=markdown',
  '--to=pdf',
  
  // Variabile LaTeX pentru stil
  // Opțiuni minime pentru a evita pachete suplimentare
  '-V', 'geometry:margin=2.5cm',
  '-V', 'fontsize=11pt',
  
  // Header și Footer simplificat
  '-V', 'title=Manual de Usuario',
  '-V', 'author=De Camino Servicios Auxiliares S.L.',
  
  // Paginare
  '--toc',
  '--toc-depth=2',
  '--number-sections',
  
  // Header LaTeX personalizat (comentat pentru a evita probleme cu pachete)
  // '--include-in-header=' + path.join(__dirname, 'pandoc-header.tex')
];

try {
  console.log('🔄 Ejecutando Pandoc...');
  
  // Configurează MiKTeX pentru instalare automată (non-interactiv)
  process.env.MIKTEX_ENABLE_INSTALLER = '1';
  process.env.MIKTEX_AUTO_INSTALL = '1';
  
  execSync('pandoc ' + pandocArgs.map(arg => `"${arg}"`).join(' '), { 
    stdio: 'inherit',
    shell: true,
    cwd: path.dirname(manualPath),
    env: {
      ...process.env,
      MIKTEX_ENABLE_INSTALLER: '1',
      MIKTEX_AUTO_INSTALL: '1'
    }
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
  console.error('❌ Error al generar PDF con Pandoc:');
  console.error(error.message);
  
  // Sugestii pentru erori comune
  if (error.message.includes('xelatex')) {
    console.error('');
    console.error('💡 Sugerencia: XeLaTeX no está instalado.');
    console.error('   Instala MiKTeX o TeX Live: https://miktex.org/download');
    console.error('   O usa otro engine: --pdf-engine=pdflatex o --pdf-engine=wkhtmltopdf');
  } else if (error.message.includes('wkhtmltopdf')) {
    console.error('');
    console.error('💡 Sugerencia: wkhtmltopdf no está instalado.');
    console.error('   Descarga desde: https://wkhtmltopdf.org/downloads.html');
  }
  
  process.exit(1);
}
