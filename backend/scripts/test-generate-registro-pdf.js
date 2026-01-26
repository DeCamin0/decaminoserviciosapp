/**
 * Script de test pentru generarea PDF-ului de Registro Horario
 * Testează generarea pentru: ANISOARA HUTOPILA (codigo: 10000063), luna: 2026-01
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { EmpleadosService } = require('../dist/src/services/empleados.service');
const { EmployeeExportService } = require('../dist/src/services/employee-export.service');
const fs = require('fs');
const path = require('path');

async function testGenerateRegistroPDF() {
  console.log('🚀 Starting test for Registro Horario PDF generation...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const empleadosService = app.get(EmpleadosService);
    const employeeExportService = app.get(EmployeeExportService);
    
    const codigo = '10000063';
    const mes = '2026-01';
    
    console.log(`📋 Testing for:`);
    console.log(`   - Codigo: ${codigo}`);
    console.log(`   - Mes: ${mes}\n`);

    // Obține angajatul
    console.log('🔍 Fetching employee data...');
    const empleado = await empleadosService.getEmpleadoByCodigo(codigo);
    
    if (!empleado) {
      console.error(`❌ Empleado with codigo ${codigo} not found!`);
      process.exit(1);
    }

    console.log(`✅ Employee found: ${empleado['NOMBRE / APELLIDOS'] || empleado.NOMBRE_APELLIDOS || 'Unknown'}`);
    console.log(`   - CODIGO: ${empleado.CODIGO}`);
    console.log(`   - NOMBRE: ${empleado.NOMBRE || 'N/A'}`);
    console.log(`   - APELLIDO1: ${empleado.APELLIDO1 || 'N/A'}`);
    console.log(`   - APELLIDO2: ${empleado.APELLIDO2 || 'N/A'}\n`);

    // Generează PDF-ul
    console.log(`📄 Generating PDF for ${mes}...`);
    const pdfBuffer = await employeeExportService.generateMonthlyRegistroPDF(
      codigo,
      mes,
      empleado
    );

    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('❌ PDF buffer is empty!');
      process.exit(1);
    }

    // Salvează PDF-ul
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `Registro_${codigo}_${mes}_test.pdf`
    );

    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`✅ PDF generated successfully!`);
    console.log(`   - Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   - Saved to: ${outputPath}\n`);

    // Informații despre PDF
    console.log('📊 PDF Info:');
    console.log(`   - Buffer length: ${pdfBuffer.length} bytes`);
    console.log(`   - File path: ${outputPath}`);
    console.log(`\n✅ Test completed successfully!`);
    console.log(`\n💡 Open the PDF file to check for empty pages and footer visibility.`);

  } catch (error) {
    console.error('❌ Error during test:');
    console.error(error);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Rulează testul
testGenerateRegistroPDF().catch((error) => {
  console.error('❌ Fatal error:');
  console.error(error);
  process.exit(1);
});
