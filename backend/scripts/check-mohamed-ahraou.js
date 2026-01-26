/**
 * Script pentru a verifica dacă "MOHAMED AHRAOU" există în baza de date
 * și de ce nu este găsit de findEmpleadoByNombre
 * 
 * Rulare: node backend/scripts/check-mohamed-ahraou.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMohamed() {
  try {
    const searchName = 'MOHAMED AHRAOU';
    console.log(`🔍 Căutând angajatul: "${searchName}"\n`);
    
    // Normalize name
    const nombreNormalized = searchName.trim().toUpperCase();
    const nombreWords = nombreNormalized.split(/\s+/).filter(w => w.length >= 2);
    
    console.log(`📋 Nume normalizat: "${nombreNormalized}"`);
    console.log(`📋 Cuvinte: [${nombreWords.join(', ')}]\n`);
    
    // Strategy 1: Exact match
    console.log('🔍 Strategy 1: Exact match...');
    let query = `
      SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
      FROM DatosEmpleados
      WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = '${nombreNormalized}'
      LIMIT 5
    `;
    let result = await prisma.$queryRawUnsafe(query);
    console.log(`   Rezultate: ${result.length}`);
    if (result.length > 0) {
      result.forEach(r => console.log(`   - CODIGO: ${r.CODIGO}, NOMBRE: ${r.nombre}`));
    }
    
    // Strategy 2: All words match
    if (nombreWords.length >= 2) {
      console.log('\n🔍 Strategy 2: All words match...');
      const wordConditions = nombreWords.map(word => 
        `TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '  ', ' '), '  ', ' '))) LIKE '%${word}%'`
      ).join(' AND ');
      query = `
        SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE ${wordConditions}
        LIMIT 10
      `;
      result = await prisma.$queryRawUnsafe(query);
      console.log(`   Rezultate: ${result.length}`);
      if (result.length > 0) {
        result.forEach(r => console.log(`   - CODIGO: ${r.CODIGO}, NOMBRE: ${r.nombre}`));
      }
    }
    
    // Strategy 3: Starts with first word
    if (nombreWords.length >= 1) {
      console.log(`\n🔍 Strategy 3: Starts with "${nombreWords[0]}"...`);
      query = `
        SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE '${nombreWords[0]}%'
        LIMIT 10
      `;
      result = await prisma.$queryRawUnsafe(query);
      console.log(`   Rezultate: ${result.length}`);
      if (result.length > 0) {
        result.forEach(r => console.log(`   - CODIGO: ${r.CODIGO}, NOMBRE: ${r.nombre}`));
      }
    }
    
    // Strategy 4: Contains full name
    console.log(`\n🔍 Strategy 4: Contains "${nombreNormalized}"...`);
    query = `
      SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
      FROM DatosEmpleados
      WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE '%${nombreNormalized}%'
      LIMIT 10
    `;
    result = await prisma.$queryRawUnsafe(query);
    console.log(`   Rezultate: ${result.length}`);
    if (result.length > 0) {
      result.forEach(r => console.log(`   - CODIGO: ${r.CODIGO}, NOMBRE: ${r.nombre}`));
    }
    
    // Search for "MOHAMED" or "AHRAOU" separately
    console.log(`\n🔍 Strategy 5: Contains "MOHAMED" or "AHRAOU"...`);
    query = `
      SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
      FROM DatosEmpleados
      WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE '%MOHAMED%'
         OR TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE '%AHRAOU%'
      LIMIT 20
    `;
    result = await prisma.$queryRawUnsafe(query);
    console.log(`   Rezultate: ${result.length}`);
    if (result.length > 0) {
      result.forEach(r => console.log(`   - CODIGO: ${r.CODIGO}, NOMBRE: ${r.nombre}`));
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkMohamed()
  .then(() => {
    console.log('\n✅ Script finalizat.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Eroare fatală:', error);
    process.exit(1);
  });
