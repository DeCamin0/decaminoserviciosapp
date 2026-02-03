#!/usr/bin/env node

/**
 * Script de Audit pentru Permisiuni
 * 
 * Scanează toate paginile din frontend/src/pages/ și identifică:
 * - Verificări de permisiuni (isManager, isAdmin, hasPermission, etc.)
 * - Modulele necesare
 * - Status backend (da/nu/parțial)
 * - Fallback-uri hardcoded
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurare
const PAGES_DIR = path.join(__dirname, '../src/pages');
const OUTPUT_FILE = path.join(__dirname, '../docs/permissions/audit-report.json');

// Pattern-uri pentru verificări de permisiuni
const PERMISSION_PATTERNS = {
  isManager: /isManager|is_manager|is-manager/gi,
  isAdmin: /isAdmin|is_admin|is-admin/gi,
  isDeveloper: /isDeveloper|is_developer|is-developer/gi,
  isSupervisor: /isSupervisor|is_supervisor|is-supervisor/gi,
  hasPermission: /hasPermission|has_permission|has-permission/gi,
  canAccess: /canAccess|can_access|can-access/gi,
  canManage: /canManage|can_manage|can-manage/gi,
  canCalculate: /canCalculate|can_calculate|can-calculate/gi,
  canEdit: /canEdit|can_edit|can-edit/gi,
  canDelete: /canDelete|can_delete|can-delete/gi,
  canCreate: /canCreate|can_create|can-create/gi,
  getPermissions: /getPermissions|get_permissions|get-permissions/gi,
  usePermissions: /usePermissions|use_permissions|use-permissions/gi,
  userPermissions: /userPermissions|user_permissions|user-permissions/gi,
  loadingPermissions: /loadingPermissions|loading_permissions|loading-permissions/gi,
};

// Pattern-uri pentru identificarea modulelor
const MODULE_PATTERNS = {
  dashboard: /dashboard|inicio/gi,
  datos: /datos|datos-personales/gi,
  empleados: /empleados/gi,
  fichar: /fichar|fichaje/gi,
  solicitudes: /solicitudes/gi,
  documentos: /documentos/gi,
  'documentos-empleados': /documentos-empleados|prl-documentos/gi,
  cuadrantes: /cuadrantes/gi,
  'cuadrantes-empleado': /cuadrantes-empleado|mi-horario/gi,
  'mis-inspecciones': /mis-inspecciones/gi,
  inspecciones: /inspecciones/gi,
  aprobaciones: /aprobaciones/gi,
  estadisticas: /estadisticas/gi,
  clientes: /clientes/gi,
  proveedores: /proveedores/gi,
  pedidos: /pedidos/gi,
  admin: /admin|admin-panel/gi,
  cuadernos: /cuadernos/gi,
  comunicados: /comunicados/gi,
  'hall-of-fame': /hall-of-fame|halloffame/gi,
};

// Pattern-uri pentru identificarea backend-ului
const BACKEND_PATTERNS = {
  usesBackend: /getPermissions|usePermissions|userPermissions|loadingPermissions|hasPermission\(/gi,
  usesOldSystem: /isManager|isAdmin|isDeveloper|isSupervisor/gi,
  mixed: /(getPermissions|usePermissions).*?(isManager|isAdmin)/gs,
};

/**
 * Citește un fișier și returnează conținutul
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Analizează un fișier și identifică verificările de permisiuni
 */
function analyzeFile(filePath, content) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(PAGES_DIR, filePath);
  
  const analysis = {
    file: fileName,
    path: relativePath,
    checks: {},
    modules: [],
    backendStatus: 'unknown',
    complexity: 0,
    lines: content.split('\n').length,
    issues: [],
  };

  // Identifică verificările de permisiuni
  for (const [key, pattern] of Object.entries(PERMISSION_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches) {
      analysis.checks[key] = matches.length;
      analysis.complexity += matches.length;
    }
  }

  // Identifică modulele necesare
  for (const [module, pattern] of Object.entries(MODULE_PATTERNS)) {
    if (pattern.test(content)) {
      analysis.modules.push(module);
    }
  }

  // Determină status backend
  const usesBackend = BACKEND_PATTERNS.usesBackend.test(content);
  const usesOldSystem = BACKEND_PATTERNS.usesOldSystem.test(content);
  const hasMixed = BACKEND_PATTERNS.mixed.test(content);

  if (usesBackend && !usesOldSystem) {
    analysis.backendStatus = 'yes';
  } else if (usesBackend && usesOldSystem) {
    analysis.backendStatus = 'partial';
  } else if (usesOldSystem) {
    analysis.backendStatus = 'no';
  } else {
    analysis.backendStatus = 'none';
  }

  // Identifică probleme potențiale
  if (hasMixed) {
    analysis.issues.push('Mixed system: uses both backend and old system');
  }
  
  if (usesOldSystem && analysis.checks.isManager > 10) {
    analysis.issues.push(`High number of isManager checks: ${analysis.checks.isManager}`);
  }

  if (analysis.complexity > 20) {
    analysis.issues.push(`High complexity: ${analysis.complexity} permission checks`);
  }

  if (analysis.modules.length === 0 && analysis.complexity > 0) {
    analysis.issues.push('Has permission checks but no clear module mapping');
  }

  return analysis;
}

/**
 * Scanează directorul de pagini
 */
function scanPagesDirectory(dir) {
  const results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);

    if (file.isDirectory()) {
      // Recursiv pentru subdirectoare
      results.push(...scanPagesDirectory(filePath));
    } else if (file.isFile() && (file.name.endsWith('.jsx') || file.name.endsWith('.tsx'))) {
      // Skip fișiere demo și lazy
      if (file.name.includes('demo-') || file.name.includes('Lazy')) {
        continue;
      }

      const content = readFile(filePath);
      if (content) {
        const analysis = analyzeFile(filePath, content);
        results.push(analysis);
      }
    }
  }

  return results;
}

/**
 * Generează raportul final
 */
function generateReport(analyses) {
  // Sortează după complexitate (descrescător)
  analyses.sort((a, b) => b.complexity - a.complexity);

  // Calculează statistici
  const stats = {
    totalPages: analyses.length,
    pagesWithBackend: analyses.filter(a => a.backendStatus === 'yes').length,
    pagesWithPartialBackend: analyses.filter(a => a.backendStatus === 'partial').length,
    pagesWithOldSystem: analyses.filter(a => a.backendStatus === 'no').length,
    pagesWithNoChecks: analyses.filter(a => a.backendStatus === 'none').length,
    totalChecks: analyses.reduce((sum, a) => sum + a.complexity, 0),
    averageChecks: 0,
    mostComplexPages: analyses.slice(0, 5).map(a => ({
      file: a.file,
      complexity: a.complexity,
    })),
  };

  stats.averageChecks = stats.totalChecks / stats.totalPages;

  // Grupează după prioritate
  const criticalPages = analyses.filter(a => 
    a.complexity > 15 || 
    (a.backendStatus === 'no' && a.complexity > 5) ||
    ['EmpleadosPage', 'CuadrantesPage', 'InspeccionesPage', 'AprobacionesPage', 'ClientesPage'].some(name => a.file.includes(name))
  );
  
  const importantPages = analyses.filter(a => 
    (a.complexity > 5 && a.complexity <= 15) ||
    a.backendStatus === 'partial'
  ).filter(a => !criticalPages.includes(a));
  
  const lowPages = analyses.filter(a => 
    a.complexity <= 5 && 
    !criticalPages.includes(a) && 
    !importantPages.includes(a)
  );
  
  const prioritized = {
    critical: criticalPages,
    important: importantPages,
    low: lowPages,
  };

  // Identifică modulele folosite
  const moduleUsage = {};
  analyses.forEach(analysis => {
    analysis.modules.forEach(module => {
      if (!moduleUsage[module]) {
        moduleUsage[module] = [];
      }
      moduleUsage[module].push(analysis.file);
    });
  });

  // Identifică verificările cele mai comune
  const checkUsage = {};
  analyses.forEach(analysis => {
    Object.entries(analysis.checks).forEach(([check, count]) => {
      if (!checkUsage[check]) {
        checkUsage[check] = { total: 0, pages: [] };
      }
      checkUsage[check].total += count;
      if (count > 0) {
        checkUsage[check].pages.push(analysis.file);
      }
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    stats,
    prioritized,
    moduleUsage,
    checkUsage,
    pages: analyses,
  };
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Starting permissions audit...\n');
  console.log(`📁 Scanning directory: ${PAGES_DIR}\n`);

  // Verifică dacă directorul există
  if (!fs.existsSync(PAGES_DIR)) {
    console.error(`❌ Directory not found: ${PAGES_DIR}`);
    process.exit(1);
  }

  // Scanează paginile
  const analyses = scanPagesDirectory(PAGES_DIR);
  
  if (analyses.length === 0) {
    console.error('❌ No pages found to analyze');
    process.exit(1);
  }

  console.log(`✅ Found ${analyses.length} pages to analyze\n`);

  // Generează raportul
  const report = generateReport(analyses);

  // Creează directorul de output dacă nu există
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Salvează raportul JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');

  // Afișează rezumat
  console.log('📊 Audit Summary:\n');
  console.log(`Total pages analyzed: ${report.stats.totalPages}`);
  console.log(`Pages with backend: ${report.stats.pagesWithBackend}`);
  console.log(`Pages with partial backend: ${report.stats.pagesWithPartialBackend}`);
  console.log(`Pages with old system: ${report.stats.pagesWithOldSystem}`);
  console.log(`Pages with no checks: ${report.stats.pagesWithNoChecks}`);
  console.log(`Total permission checks: ${report.stats.totalChecks}`);
  console.log(`Average checks per page: ${report.stats.averageChecks.toFixed(2)}\n`);

  console.log('🔴 Critical pages:');
  report.prioritized.critical.forEach(page => {
    console.log(`  - ${page.file} (complexity: ${page.complexity}, backend: ${page.backendStatus})`);
  });

  console.log('\n🟡 Important pages:');
  report.prioritized.important.slice(0, 10).forEach(page => {
    console.log(`  - ${page.file} (complexity: ${page.complexity}, backend: ${page.backendStatus})`);
  });

  console.log(`\n✅ Report saved to: ${OUTPUT_FILE}`);
  console.log('\n💡 Next steps:');
  console.log('  1. Review the JSON report for detailed analysis');
  console.log('  2. Update PERMISSIONS_ACTION_PLAN.md with findings');
  console.log('  3. Start migrating pages in priority order');
}

// Rulează scriptul
main();

export { analyzeFile, scanPagesDirectory, generateReport };
