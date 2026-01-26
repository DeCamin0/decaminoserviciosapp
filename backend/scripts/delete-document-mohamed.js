/**
 * Script pentru a șterge documentul "VARIOS DOCUMENTOS MOHAMED AHRAOU.pdf"
 * care a fost salvat fără angajat asociat
 * 
 * Rulare: node backend/scripts/delete-document-mohamed.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteDocument() {
  try {
    console.log('🔍 Căutând documentul "VARIOS DOCUMENTOS MOHAMED AHRAOU.pdf"...');
    
    // Găsește documentul
    const documents = await prisma.$queryRawUnsafe(`
      SELECT 
        doc_id,
        id,
        detected_empleado_id,
        nombre_archivo,
        nombre_empleado,
        fecha_creacion,
        status,
        source_message_id,
        source_attachment_id
      FROM \`DocumentosOficiales\`
      WHERE nombre_archivo LIKE '%VARIOS DOCUMENTOS MOHAMED AHRAOU%'
        AND (id = 'PENDING' OR detected_empleado_id IS NULL OR detected_empleado_id = '')
      ORDER BY fecha_creacion DESC
      LIMIT 10
    `);
    
    if (documents.length === 0) {
      console.log('❌ Nu s-a găsit niciun document fără angajat asociat.');
      return;
    }
    
    console.log(`\n📋 Găsite ${documents.length} document(e):`);
    documents.forEach((doc, index) => {
      console.log(`\n${index + 1}. doc_id: ${doc.doc_id}`);
      console.log(`   id: ${doc.id}`);
      console.log(`   detected_empleado_id: ${doc.detected_empleado_id || 'NULL'}`);
      console.log(`   nombre_archivo: ${doc.nombre_archivo}`);
      console.log(`   nombre_empleado: ${doc.nombre_empleado || 'NULL'}`);
      console.log(`   fecha_creacion: ${doc.fecha_creacion}`);
      console.log(`   status: ${doc.status}`);
    });
    
    // Șterge primul document (cel mai recent)
    const docToDelete = documents[0];
    console.log(`\n🗑️  Ștergând documentul doc_id=${docToDelete.doc_id}...`);
    
    // Escape SQL string manually
    const escapeSql = (value) => {
      if (value === null || value === undefined) return 'NULL';
      const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `'${escaped}'`;
    };
    
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM \`DocumentosOficiales\`
      WHERE doc_id = ${docToDelete.doc_id}
        AND nombre_archivo = ${escapeSql(docToDelete.nombre_archivo)}
      LIMIT 1
    `);
    
    const affectedRows = Number(result) || 0;
    
    if (affectedRows > 0) {
      console.log(`✅ Document șters cu succes! (doc_id: ${docToDelete.doc_id})`);
    } else {
      console.log(`❌ Nu s-a șters niciun document.`);
    }
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează scriptul
deleteDocument()
  .then(() => {
    console.log('\n✅ Script finalizat.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Eroare fatală:', error);
    process.exit(1);
  });
