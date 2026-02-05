/**
 * Script pentru a verifica coloanele REALE care lipsesc din schema Prisma
 * Filtrează false positives (cuvinte cheie SQL, variabile JS, etc.)
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificare precisă a coloanelor reale...\n');

// Citește schema Prisma
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Extrage toate modelele și coloanele lor
const modelMatches = schemaContent.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/gs);
const models = {};

for (const match of modelMatches) {
  const modelName = match[1];
  const modelBody = match[2];
  
  const columns = [];
  const columnMatches = modelBody.matchAll(/(\w+)\s+([^\n]+)/g);
  
  for (const colMatch of columnMatches) {
    const columnName = colMatch[1].trim();
    if (columnName && !columnName.startsWith('@@') && columnName !== 'model' && !columnName.startsWith('@')) {
      const mapMatch = colMatch[2].match(/@map\(["']([^"']+)["']\)/);
      const dbColumnName = mapMatch ? mapMatch[1] : columnName;
      columns.push({
        prismaName: columnName,
        dbName: dbColumnName.toLowerCase(),
      });
    }
  }
  
  const tableMapMatch = modelBody.match(/@@map\(["']([^"']+)["']\)/);
  const tableName = tableMapMatch ? tableMapMatch[1] : modelName;
  
  models[modelName] = {
    tableName: tableName,
    columns: columns,
  };
}

// Cuvinte cheie SQL și JavaScript care trebuie ignorate
const ignoreKeywords = new Set([
  'select', 'from', 'where', 'set', 'insert', 'into', 'update', 'delete',
  'values', 'and', 'or', 'not', 'null', 'case', 'when', 'then', 'else', 'end',
  'as', 'join', 'inner', 'left', 'right', 'on', 'group', 'by', 'order', 'limit',
  'offset', 'having', 'union', 'all', 'distinct', 'count', 'sum', 'max', 'min',
  'avg', 'concat', 'date_format', 'str_to_date', 'time_to_sec', 'datediff',
  'timestampdiff', 'greatest', 'least', 'coalesce', 'exists', 'in', 'like',
  'regexp', 'between', 'is', 'if', 'substring_index', 'trim', 'upper', 'lower',
  'cast', 'convert', 'date', 'time', 'datetime', 'timestamp', 'interval', 'day',
  'month', 'year', 'hour', 'minute', 'second', 'now', 'curdate', 'curtime',
  'date_add', 'date_sub', 'dayofweek', 'dayname', 'monthname', 'quarter', 'week',
  'weekday', 'yearweek', 'sec_to_time', 'time_to_sec', 'timediff', 'timestampadd',
  'timestampdiff', 'adddate', 'subdate', 'datediff', 'period_diff', 'to_days',
  'from_days', 'from_unixtime', 'unix_timestamp', 'weekday', 'yearweek',
  'findmany', 'findunique', 'findfirst', 'create', 'update', 'delete', 'upsert',
  'count', 'groupby', 'deletemany', 'updatemany', 'createmany', 'undefined',
  'data', 'service', 'length', 'push', 'map', 'some', 'every', 'json',
  'actualizează', 'solicitudbefore', 'mutuacasos', 'd', 'fecha', 'updated_at',
  'cliente_id', 'empleado_id', 'doc_id', 'detected_empleado_id', 'tipo',
  'employee_codigo', 'workday_date', 'nombre_bd', 'empleado_encontrado',
  'acceptat', 'dias_neutre_val', 'centro_nombre', 'luna', 'grupo', 'status',
  'd_first_m', 'codigo_empleado', 'inspeccion_id', 'estado', 'pedido_uid',
  'grupo_nombre', 'activo', 'template_id', 'tipo_documento', 'solicitud_id',
  'ausencia_asociada_id', 'codigo', 'id', 'count(*)', 'avg(id', 'round(sum',
  'cast(cq', 'cast(de', 'cq', 'cs', 'hm', 'cg', 'c', 'cc', 'ed', 't',
  'coalesce(ccaa', 'concat(\\nombre', 'cast(\\vacaciones_anuales_personalizadas\\',
  'cast(\\asuntos_propios_anuales_personalizadas\\', 'zi_${dia}', 'empleadoid',
  'empleadocodigo', 'nombrearchivo', 'archivobuffer', 'empleadonombre',
  'recipienttype', 'recipientid', 'recipientemail', 'additionalmessage',
  'createdby', 'convenio_activo', 'dias_vacaciones_anuales', 'convenio_nombre',
  'convenio_id_real', 'dias_asuntos_propios_anuales', 'max(centro_cuadrante)',
  'datetime', 'cp',
]);

// Citește fișierele din services
const servicesPath = path.join(__dirname, '../src/services');
const allFiles = [];

function getAllTsFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllTsFiles(filePath);
    } else if (file.endsWith('.ts')) {
      allFiles.push(filePath);
    }
  }
}

getAllTsFiles(servicesPath);

console.log(`📁 Analizând ${allFiles.length} fișiere...\n`);

// Verifică doar tabelele importante
const importantTables = ['Ausencias', 'Solicitudes', 'Fichaje', 'MutuaCasos', 'solicitudes'];
const realIssues = [];

for (const [modelName, modelInfo] of Object.entries(models)) {
  if (!importantTables.includes(modelName) && !importantTables.includes(modelInfo.tableName)) {
    continue;
  }
  
  const tableName = modelInfo.tableName;
  const schemaColumns = new Set(modelInfo.columns.map(c => c.dbName));
  const schemaColumnsPrisma = new Set(modelInfo.columns.map(c => c.prismaName.toLowerCase()));
  
  const usedColumns = new Set();
  
  // Caută în toate fișierele
  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Pattern mai precis pentru INSERT/UPDATE/SELECT
      const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const insertPattern = new RegExp('INSERT\\s+INTO\\s+[`]?' + escapedTableName + '[`]?\\s*\\(([^\\)]+)\\)', 'gi');
      const updatePattern = new RegExp('UPDATE\\s+[`]?' + escapedTableName + '[`]?\\s+SET\\s+([^W]+)', 'gi');
      const selectPattern = new RegExp('SELECT\\s+([^F]+)\\s+FROM\\s+[`]?' + escapedTableName + '[`]?', 'gi');
      
      const patterns = [insertPattern, updatePattern, selectPattern];
      
      for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const columnsStr = match[1] || '';
          
          // Extrage numele coloanelor (mai precis)
          const parts = columnsStr.split(',');
          for (const part of parts) {
            // Elimină backticks, spații, și extrage primul identificator valid
            let cleaned = part.trim()
              .replace(/`/g, '')
              .replace(/\s+/g, ' ')
              .split(/\s+/)[0]
              .split('.')[0]
              .split('(')[0]
              .split(')')[0]
              .toLowerCase();
            
            // Verifică dacă este un identificator valid de coloană
            if (cleaned && 
                cleaned.length > 0 && 
                cleaned.match(/^[a-z_][a-z0-9_]*$/) &&
                !ignoreKeywords.has(cleaned) &&
                !cleaned.match(/^\d+$/) &&
                !cleaned.includes('$') &&
                !cleaned.includes('\\')) {
              usedColumns.add(cleaned);
            }
          }
        }
      }
      
      // Caută și în WHERE clauses specifice pentru acest tabel
      const wherePattern = new RegExp('WHERE\\s+[`]?' + escapedTableName + '[`]?\\.[`]?([a-z_][a-z0-9_]*)[`]?', 'gi');
      const whereMatches = content.matchAll(wherePattern);
      for (const match of whereMatches) {
        const col = match[1].toLowerCase();
        if (col && !ignoreKeywords.has(col)) {
          usedColumns.add(col);
        }
      }
    } catch (error) {
      // Ignoră erorile
    }
  }
  
  // Compară doar coloanele reale
  const missingColumns = Array.from(usedColumns).filter(col => {
    return !schemaColumns.has(col) && !schemaColumnsPrisma.has(col);
  });
  
  if (missingColumns.length > 0) {
    realIssues.push({
      model: modelName,
      table: tableName,
      missing: missingColumns,
    });
  }
}

// Raportează rezultatele
if (realIssues.length === 0) {
  console.log('✅ Nu s-au găsit coloane reale care lipsesc din schema Prisma!\n');
} else {
  console.log(`❌ Găsite ${realIssues.length} probleme reale:\n`);
  
  for (const issue of realIssues) {
    console.log(`📋 Model: ${issue.model} (Tabel: ${issue.table})`);
    console.log(`   Coloane LIPSESC din schema Prisma:`);
    issue.missing.forEach(col => {
      console.log(`     - ${col}`);
    });
    console.log('');
  }
}

console.log('✅ Verificare finalizată!\n');
