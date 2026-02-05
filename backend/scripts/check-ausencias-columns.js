/**
 * Script pentru a verifica dacă toate coloanele folosite în cod există în schema Prisma
 */

const fs = require('fs');
const path = require('path');

// Citește schema Prisma
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Extrage coloanele din modelul Ausencias
const ausenciasModelMatch = schemaContent.match(/model Ausencias\s*\{([^}]+)\}/s);
if (!ausenciasModelMatch) {
  console.error('❌ Nu s-a găsit modelul Ausencias în schema Prisma');
  process.exit(1);
}

const ausenciasModel = ausenciasModelMatch[1];
const columnsInSchema = [];

// Extrage toate coloanele din model
const columnMatches = ausenciasModel.matchAll(/(\w+)\s+([^\n]+)/g);
for (const match of columnMatches) {
  const columnName = match[1].trim();
  if (columnName && !columnName.startsWith('@@') && columnName !== 'model') {
    // Extrage numele real al coloanei (poate fi mapat cu @map)
    const mapMatch = match[2].match(/@map\(["']([^"']+)["']\)/);
    const dbColumnName = mapMatch ? mapMatch[1] : columnName;
    columnsInSchema.push({
      prismaName: columnName,
      dbName: dbColumnName,
    });
  }
}

console.log('📋 Coloane în schema Prisma (Ausencias):');
columnsInSchema.forEach(col => {
  console.log(`  - ${col.prismaName} (DB: ${col.dbName})`);
});

// Citește fișierele de servicii pentru a găsi coloanele folosite
const servicesPath = path.join(__dirname, '../src/services');
const ausenciasServicePath = path.join(servicesPath, 'ausencias.service.ts');
const solicitudesServicePath = path.join(servicesPath, 'solicitudes.service.ts');

const ausenciasServiceContent = fs.readFileSync(ausenciasServicePath, 'utf-8');
const solicitudesServiceContent = fs.readFileSync(solicitudesServicePath, 'utf-8');

// Extrage toate coloanele folosite în query-uri SQL
const usedColumns = new Set();

// Pattern pentru a găsi coloane în query-uri SQL
const sqlPatterns = [
  /INSERT INTO Ausencias\s*\(([^)]+)\)/gi,
  /SELECT\s+([^F]+)\s+FROM\s+Ausencias/gi,
  /UPDATE\s+Ausencias\s+SET\s+([^W]+)/gi,
  /WHERE\s+(\w+)\s*=/gi,
  /(\w+)\s*=\s*VALUES\(/gi,
];

const allContent = ausenciasServiceContent + '\n' + solicitudesServiceContent;

for (const pattern of sqlPatterns) {
  const matches = allContent.matchAll(pattern);
  for (const match of matches) {
    const columnsStr = match[1] || match[0];
    // Extrage numele coloanelor
    const columnNames = columnsStr.split(',').map(col => {
      const cleaned = col.trim().replace(/`/g, '').split(/\s+/)[0];
      return cleaned;
    }).filter(col => col && !col.match(/^(SELECT|FROM|WHERE|SET|INSERT|INTO|UPDATE)$/i));
    
    columnNames.forEach(col => {
      if (col && col.length > 0) {
        usedColumns.add(col);
      }
    });
  }
}

// Verifică și coloanele din query-uri cu backticks
const backtickMatches = allContent.matchAll(/`([^`]+)`/g);
for (const match of backtickMatches) {
  const col = match[1].trim();
  if (col && !col.includes(' ') && col.length > 0) {
    usedColumns.add(col);
  }
}

console.log('\n📋 Coloane folosite în cod:');
const usedColumnsArray = Array.from(usedColumns).sort();
usedColumnsArray.forEach(col => {
  console.log(`  - ${col}`);
});

// Compară
console.log('\n🔍 Comparație:');
const schemaDbNames = columnsInSchema.map(col => col.dbName);
const missingColumns = usedColumnsArray.filter(col => {
  // Verifică dacă coloana există în schema (fie ca prismaName, fie ca dbName)
  return !schemaDbNames.includes(col) && 
         !columnsInSchema.some(sc => sc.prismaName === col);
});

if (missingColumns.length > 0) {
  console.log('\n❌ Coloane folosite în cod dar LIPSESC din schema Prisma:');
  missingColumns.forEach(col => {
    console.log(`  - ${col}`);
  });
} else {
  console.log('\n✅ Toate coloanele folosite în cod sunt prezente în schema Prisma!');
}

// Verifică și coloanele din schema care nu sunt folosite (doar informativ)
const unusedColumns = columnsInSchema.filter(col => {
  return !usedColumnsArray.includes(col.dbName) && 
         !usedColumnsArray.includes(col.prismaName);
});

if (unusedColumns.length > 0) {
  console.log('\n⚠️  Coloane în schema Prisma dar nefolosite în cod (doar informativ):');
  unusedColumns.forEach(col => {
    console.log(`  - ${col.prismaName} (DB: ${col.dbName})`);
  });
}
