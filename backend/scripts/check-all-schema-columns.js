/**
 * Script pentru a verifica dacă toate coloanele folosite în cod există în schema Prisma
 * Verifică toate tabelele din proiect
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificare completă a coloanelor din schema Prisma vs cod...\n');

// Citește schema Prisma
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Extrage toate modelele din schema
const modelMatches = schemaContent.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/gs);
const models = {};

for (const match of modelMatches) {
  const modelName = match[1];
  const modelBody = match[2];
  
  const columns = [];
  const columnMatches = modelBody.matchAll(/(\w+)\s+([^\n]+)/g);
  
  for (const colMatch of columnMatches) {
    const columnName = colMatch[1].trim();
    if (columnName && !columnName.startsWith('@@') && columnName !== 'model') {
      // Extrage numele real al coloanei (poate fi mapat cu @map)
      const mapMatch = colMatch[2].match(/@map\(["']([^"']+)["']\)/);
      const dbColumnName = mapMatch ? mapMatch[1] : columnName;
      
      // Verifică dacă este o coloană validă (nu este un decorator sau altceva)
      if (!columnName.startsWith('@') && columnName.length > 0) {
        columns.push({
          prismaName: columnName,
          dbName: dbColumnName,
        });
      }
    }
  }
  
  // Extrage și numele tabelului din @@map dacă există
  const tableMapMatch = modelBody.match(/@@map\(["']([^"']+)["']\)/);
  const tableName = tableMapMatch ? tableMapMatch[1] : modelName;
  
  models[modelName] = {
    tableName: tableName,
    columns: columns,
  };
}

console.log(`📋 Găsite ${Object.keys(models).length} modele în schema Prisma:\n`);

// Citește toate fișierele .ts din src/services
const servicesPath = path.join(__dirname, '../src/services');
const allFiles = [];

function getAllTsFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllTsFiles(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      allFiles.push(filePath);
    }
  }
}

getAllTsFiles(servicesPath);

console.log(`📁 Analizând ${allFiles.length} fișiere din services...\n`);

// Pentru fiecare model, caută coloanele folosite în cod
const issues = [];

for (const [modelName, modelInfo] of Object.entries(models)) {
  const tableName = modelInfo.tableName;
  const schemaColumns = new Set(modelInfo.columns.map(c => c.dbName.toLowerCase()));
  const schemaColumnsPrisma = new Set(modelInfo.columns.map(c => c.prismaName.toLowerCase()));
  
  const usedColumns = new Set();
  
  // Caută în toate fișierele
  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Pattern pentru a găsi query-uri SQL care folosesc acest tabel
      const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [
        // INSERT INTO TableName
        new RegExp('INSERT\\s+INTO\\s+[`]?' + escapedTableName + '[`]?\\s*\\(([^\\)]+)\\)', 'gi'),
        // SELECT ... FROM TableName
        new RegExp('SELECT\\s+([^F]+)\\s+FROM\\s+[`]?' + escapedTableName + '[`]?', 'gi'),
        // UPDATE TableName SET
        new RegExp('UPDATE\\s+[`]?' + escapedTableName + '[`]?\\s+SET\\s+([^W]+)', 'gi'),
        // WHERE column = sau column IN
        new RegExp('WHERE\\s+[`]?([a-zA-Z_][a-zA-Z0-9_]*)[`]?\\s*[=<>]', 'gi'),
        // Backticks pentru coloane
        new RegExp('[`]' + escapedTableName + '[`]\\.[`]([a-zA-Z_][a-zA-Z0-9_]*)[`]', 'gi'),
        // Coloane cu backticks simple
        new RegExp('[`]([a-zA-Z_][a-zA-Z0-9_\\s/]+)[`]', 'gi'),
      ];
      
      for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const columnsStr = match[1] || '';
          
          // Extrage numele coloanelor
          const columnNames = columnsStr
            .split(',')
            .map(col => {
              // Elimină backticks, spații, și extrage primul cuvânt
              const cleaned = col.trim()
                .replace(/`/g, '')
                .replace(/\s+/g, ' ')
                .split(/\s+/)[0]
                .split('.')[0]; // Pentru table.column
              
              return cleaned;
            })
            .filter(col => {
              // Filtrează cuvintele cheie SQL
              const sqlKeywords = [
                'select', 'from', 'where', 'set', 'insert', 'into', 'update',
                'values', 'and', 'or', 'not', 'null', 'case', 'when', 'then',
                'else', 'end', 'as', 'join', 'inner', 'left', 'right', 'on',
                'group', 'by', 'order', 'limit', 'offset', 'having', 'union',
                'all', 'distinct', 'count', 'sum', 'max', 'min', 'avg',
                'concat', 'date_format', 'str_to_date', 'time_to_sec',
                'datediff', 'timestampdiff', 'greatest', 'least', 'coalesce',
                'exists', 'in', 'like', 'regexp', 'between', 'is', 'if',
                'substring_index', 'trim', 'upper', 'lower', 'cast', 'convert',
                'date', 'time', 'datetime', 'timestamp', 'interval', 'day',
                'month', 'year', 'hour', 'minute', 'second', 'now', 'curdate',
                'curtime', 'date_add', 'date_sub', 'dayofweek', 'dayname',
                'monthname', 'quarter', 'week', 'weekday', 'yearweek',
              ];
              
              return col && 
                     col.length > 0 && 
                     !sqlKeywords.includes(col.toLowerCase()) &&
                     !col.match(/^\d+$/) && // Nu numere
                     !col.match(/^['"]/) && // Nu string-uri
                     !col.match(/^\(/) && // Nu expresii
                     col.match(/^[a-zA-Z_]/); // Începe cu literă sau underscore
            });
          
          columnNames.forEach(col => {
            if (col && col.length > 0) {
              usedColumns.add(col.toLowerCase());
            }
          });
        }
      }
      
      // Caută și referințe directe la coloane (ex: item.CODIGO, ausencia.TIPO)
      const escapedModelName = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const directRefPattern = new RegExp('\\b(' + escapedTableName + '|' + escapedModelName + ')\\.([a-zA-Z_][a-zA-Z0-9_]+)', 'gi');
      const directMatches = content.matchAll(directRefPattern);
      for (const match of directMatches) {
        const colName = match[2].toLowerCase();
        if (colName && colName.length > 0) {
          usedColumns.add(colName);
        }
      }
    } catch (error) {
      // Ignoră erorile de citire
    }
  }
  
  // Compară coloanele folosite cu cele din schema
  const missingColumns = Array.from(usedColumns).filter(col => {
    return !schemaColumns.has(col) && !schemaColumnsPrisma.has(col);
  });
  
  if (missingColumns.length > 0) {
    issues.push({
      model: modelName,
      table: tableName,
      missing: missingColumns,
    });
  }
}

// Raportează rezultatele
if (issues.length === 0) {
  console.log('✅ Toate coloanele folosite în cod sunt prezente în schema Prisma!\n');
} else {
  console.log(`❌ Găsite ${issues.length} probleme:\n`);
  
  for (const issue of issues) {
    console.log(`📋 Model: ${issue.model} (Tabel: ${issue.table})`);
    console.log(`   Coloane LIPSESC din schema Prisma:`);
    issue.missing.forEach(col => {
      console.log(`     - ${col}`);
    });
    console.log('');
  }
}

// Listă și coloanele din schema care nu sunt folosite (doar informativ, pentru cele mai importante tabele)
console.log('\n📊 Statistici pentru tabelele principale:\n');

const importantTables = ['Ausencias', 'Solicitudes', 'Fichaje', 'DatosEmpleados', 'MutuaCasos'];
for (const tableName of importantTables) {
  const model = Object.entries(models).find(([name]) => name === tableName);
  if (model) {
    const [, modelInfo] = model;
    console.log(`📋 ${tableName} (${modelInfo.tableName}):`);
    console.log(`   Coloane în schema: ${modelInfo.columns.length}`);
    console.log(`   Coloane: ${modelInfo.columns.map(c => c.prismaName).join(', ')}`);
    console.log('');
  }
}

console.log('✅ Verificare completă finalizată!\n');
