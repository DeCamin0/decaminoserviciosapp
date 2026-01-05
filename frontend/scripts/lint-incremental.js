#!/usr/bin/env node

/**
 * ESLint incremental runner - procesează fișierele unul câte unul
 * pentru a evita out of memory errors
 * Suportă resume - continuă de unde a rămas
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const MAX_MEMORY = '8192'; // 8GB per fișier
const MAX_MEMORY_LARGE = '16384'; // 16GB pentru fișiere mari (>4000 linii)
const LARGE_FILE_THRESHOLD = 4000; // Număr de linii pentru a considera un fișier "mare"
const VERY_LARGE_FILE_THRESHOLD = 4500; // Fișiere foarte mari - vor fi ignorate sau procesate cu opțiuni mai simple
const PROGRESS_FILE = '.eslint-progress.json';

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, build, etc.
      if (!['node_modules', 'dist', 'build', 'dev-dist', '.vite', 'android', 'ios'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (EXTENSIONS.includes(extname(file))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function getFileLineCount(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    try {
      const content = readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(content);
    } catch {
      return { lastFile: null, verifiedFiles: [], skippedFiles: [] };
    }
  }
  return { lastFile: null, verifiedFiles: [], skippedFiles: [] };
}

function saveProgress(lastFile, verifiedFiles, skippedFiles = []) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ lastFile, verifiedFiles, skippedFiles }, null, 2), 'utf8');
  } catch (error) {
    console.warn(`⚠️ Nu s-a putut salva progresul: ${error.message}`);
  }
}

function clearProgress() {
  if (existsSync(PROGRESS_FILE)) {
    try {
      unlinkSync(PROGRESS_FILE);
    } catch {
      // Ignoră eroarea
    }
  }
}

function lintFile(filePath, skipVeryLarge = false) {
  try {
    const relativePath = filePath.replace(process.cwd() + '\\', '');
    const lineCount = getFileLineCount(filePath);
    const isLargeFile = lineCount > LARGE_FILE_THRESHOLD;
    const isVeryLargeFile = lineCount > VERY_LARGE_FILE_THRESHOLD;
    
    // Skip fișiere foarte mari dacă este setat
    if (isVeryLargeFile && skipVeryLarge) {
      console.log(`\n⏭️  SKIP (foarte mare - ${lineCount} linii): ${relativePath}`);
      console.log(`   💡 Sugestie: Verifică manual sau adaugă în .eslintignore`);
      return { success: true, skipped: true };
    }
    
    const memorySize = isLargeFile ? MAX_MEMORY_LARGE : MAX_MEMORY;
    
    if (isVeryLargeFile) {
      console.log(`\n⚠️  Linting (FOARTE MARE - ${lineCount} linii, ${memorySize}MB memorie): ${relativePath}`);
      console.log(`   ⚠️  Acest fișier poate cauza probleme de memorie!`);
    } else if (isLargeFile) {
      console.log(`\n🔍 Linting (LARGE FILE - ${lineCount} linii, ${memorySize}MB memorie): ${relativePath}`);
    } else {
      console.log(`\n🔍 Linting: ${relativePath}`);
    }
    
    // Pentru fișiere foarte mari, folosim opțiuni mai simple
    const eslintOptions = isVeryLargeFile
      ? `--ext js,jsx,ts,tsx --max-warnings 0 --cache --cache-location .eslintcache --no-eslintrc --config .eslintrc.json`
      : `--ext js,jsx,ts,tsx --report-unused-disable-directives --max-warnings 0 --cache --cache-location .eslintcache`;
    
    // Setează NODE_OPTIONS direct în environment
    const env = {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${memorySize}`
    };
    
    execSync(
      `npx eslint "${filePath}" ${eslintOptions}`,
      { 
        stdio: 'inherit', 
        cwd: process.cwd(),
        env: env
      }
    );
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`\n❌ Eroare la linting: ${filePath}`);
    return { success: false, skipped: false };
  }
}

function main() {
  // Verifică argumentele pentru opțiuni
  const args = process.argv.slice(2);
  const skipVeryLarge = args.includes('--skip-very-large');
  const resume = args.includes('--resume');
  const clear = args.includes('--clear');
  
  if (clear) {
    clearProgress();
    console.log('✅ Progresul a fost șters.');
    return;
  }
  
  // Asigură-te că rulezi din directorul frontend/
  const srcDir = join(process.cwd(), 'src');
  console.log(`\n📁 Scanare fișiere în: ${srcDir}`);
  
  // Verifică dacă directorul există
  try {
    statSync(srcDir);
  } catch (error) {
    console.error(`\n❌ Directorul src nu există: ${srcDir}`);
    console.error(`   CWD actual: ${process.cwd()}`);
    console.error(`   Rulează scriptul din directorul frontend/`);
    process.exit(1);
  }
  
  const allFiles = getAllFiles(srcDir);
  console.log(`\n📊 Găsite ${allFiles.length} fișiere pentru linting`);
  
  // Încarcă progresul dacă există
  let startIndex = 0;
  let verifiedFiles = [];
  let skippedFiles = [];
  
  if (resume) {
    const progress = loadProgress();
    if (progress.lastFile) {
      const lastFileIndex = allFiles.findIndex(f => f === progress.lastFile || f.replace(process.cwd() + '\\', '') === progress.lastFile);
      if (lastFileIndex !== -1) {
        startIndex = lastFileIndex + 1;
        verifiedFiles = progress.verifiedFiles || [];
        skippedFiles = progress.skippedFiles || [];
        console.log(`\n🔄 Continuă de la fișierul ${startIndex + 1}/${allFiles.length}`);
        console.log(`   Ultimul fișier verificat: ${progress.lastFile.replace(process.cwd() + '\\', '')}`);
      } else {
        console.log(`\n⚠️  Ultimul fișier din progres nu a fost găsit, încep de la început.`);
      }
    }
  }
  
  const files = allFiles.slice(startIndex);
  console.log(`\n📋 Fișiere de procesat: ${files.length} (${startIndex} deja verificate)\n`);
  
  let successCount = verifiedFiles.length;
  let skippedCount = skippedFiles.length;
  
  // Procesează fișierele unul câte unul și oprește-te la prima eroare/warning
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const globalIndex = startIndex + i;
    console.log(`\n[${globalIndex + 1}/${allFiles.length}]`);
    
    const result = lintFile(file, skipVeryLarge);
    
    if (result.skipped) {
      skippedCount++;
      skippedFiles.push(file);
      verifiedFiles.push(file);
      saveProgress(file, verifiedFiles, skippedFiles);
      continue;
    }
    
    if (!result.success) {
      // Eroare sau warning găsit - salvează progresul și oprește procesarea
      saveProgress(file, verifiedFiles, skippedFiles);
      console.log(`\n\n❌ OPRIT: Eroare sau warning găsit în fișierul de mai sus.`);
      console.log(`\n📊 Rezumat:`);
      console.log(`   Fișiere verificate: ${globalIndex + 1}/${allFiles.length}`);
      console.log(`   Fișiere OK: ${successCount}`);
      console.log(`   Fișiere skip-uite: ${skippedCount}`);
      console.log(`   Fișier cu probleme: ${file.replace(process.cwd() + '\\', '')}`);
      if (skippedCount > 0) {
        console.log(`\n📋 Fișiere sărite:`);
        skippedFiles.forEach(skipped => {
          const relative = skipped.replace(process.cwd() + '\\', '');
          const lines = getFileLineCount(skipped);
          console.log(`   - ${relative} (${lines} linii)`);
        });
      }
      console.log(`\n💡 Pentru a continua de unde ai rămas, rulează: npm run lint:resume`);
      process.exit(1);
    }
    
    successCount++;
    verifiedFiles.push(file);
    
    // Salvează progresul la fiecare 10 fișiere
    if ((i + 1) % 10 === 0) {
      saveProgress(file, verifiedFiles, skippedFiles);
    }
  }
  
  // Toate fișierele au trecut
  console.log(`\n\n✅ Rezumat:`);
  console.log(`   Fișiere verificate: ${allFiles.length}/${allFiles.length}`);
  console.log(`   Fișiere OK: ${successCount}`);
  if (skippedCount > 0) {
    console.log(`   Fișiere skip-uite: ${skippedCount}`);
    console.log(`\n📋 Fișiere sărite (foarte mari - pot cauza probleme de memorie):`);
    skippedFiles.forEach(skipped => {
      const relative = skipped.replace(process.cwd() + '\\', '');
      const lines = getFileLineCount(skipped);
      console.log(`   - ${relative} (${lines} linii)`);
    });
    console.log(`\n💡 Pentru a verifica manual un fișier sărit, rulează:`);
    skippedFiles.forEach(skipped => {
      const relative = skipped.replace(process.cwd() + '\\', '');
      console.log(`   npx eslint "${relative}" --ext js,jsx,ts,tsx --max-warnings 0`);
    });
  } else {
    clearProgress(); // Șterge progresul doar dacă nu sunt fișiere sărite
  }
  console.log(`\n   Toate fișierele au trecut linting-ul!`);
  process.exit(0);
}

main();

