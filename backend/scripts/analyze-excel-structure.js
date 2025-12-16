const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../n8n-snapshots/MutuaUniversal_Casos_20251212_132003_24575.xlsx');

console.log('📊 Analizând Excel:', excelPath);

try {
  const workbook = XLSX.readFile(excelPath);
  
  console.log('\n📋 Sheet-uri disponibile:');
  workbook.SheetNames.forEach((name, index) => {
    console.log(`  ${index + 1}. "${name}"`);
  });
  
  // Verifică dacă există sheet "Común"
  const sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('común') || 
    name.toLowerCase().includes('comun')
  ) || workbook.SheetNames[0];
  
  console.log(`\n📄 Analizez sheet: "${sheetName}"`);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    raw: false, // Pentru a vedea valorile exacte
    defval: '' // Valori default
  });
  
  if (data.length === 0) {
    console.log('❌ Sheet-ul este gol!');
    process.exit(1);
  }
  
  console.log(`\n📊 Rânduri găsite: ${data.length}`);
  console.log('\n🔍 Coloane identificate:');
  
  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  columns.forEach((col, index) => {
    console.log(`  ${index + 1}. "${col}"`);
  });
  
  console.log('\n📝 Primele 2 rânduri de date:');
  console.log(JSON.stringify(data.slice(0, 2), null, 2));
  
  console.log('\n✅ Analiză completă!');
  
} catch (error) {
  console.error('❌ Eroare la citirea Excel-ului:', error.message);
  process.exit(1);
}

