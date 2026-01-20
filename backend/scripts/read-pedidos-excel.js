const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'PEDIDOS 15.01.2026.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found:', filePath);
      process.exit(1);
    }

    console.log('📄 Reading Excel file:', filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log('\n📋 Sheets found:', workbook.worksheets.map(s => s.name));
    console.log('📊 Total sheets:', workbook.worksheets.length);

    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 Sheet ${sheetIndex + 1}: "${worksheet.name}"`);
      console.log(`${'='.repeat(80)}`);
      console.log('📊 Total rows:', worksheet.rowCount);
      console.log('📊 Total columns:', worksheet.columnCount);

      // Analizează primele 50 de rânduri pentru a înțelege structura
      const maxRows = Math.min(50, worksheet.rowCount);
      console.log(`\n📋 First ${maxRows} rows (structure analysis):\n`);
      
      for (let i = 1; i <= maxRows; i++) {
        const row = worksheet.getRow(i);
        const values = [];
        
        for (let colNumber = 1; colNumber <= Math.min(20, worksheet.columnCount); colNumber++) {
          const cell = row.getCell(colNumber);
          let value = cell.value;
          
          if (value === null || value === undefined) {
            value = '';
          } else if (typeof value === 'object' && value.text !== undefined) {
            value = value.text;
          } else if (typeof value === 'object') {
            value = JSON.stringify(value).substring(0, 50);
          }
          
          values.push(String(value).substring(0, 30));
        }
        
        if (values.some(v => v.trim() !== '')) {
          console.log(`Row ${i}:`, values.join(' | '));
        }
      }

      // Analizează formatarea (merges, styles, etc.)
      console.log(`\n🎨 Formatting analysis:`);
      console.log(`- Merged cells: ${worksheet.model.merges?.length || 0}`);
      
      if (worksheet.model.merges && worksheet.model.merges.length > 0) {
        console.log('  First 10 merged cells:');
        worksheet.model.merges.slice(0, 10).forEach(merge => {
          console.log(`    ${merge}`);
        });
      }

      // Verifică imagini
      if (worksheet.model.images && worksheet.model.images.length > 0) {
        console.log(`\n🖼️ Images found: ${worksheet.model.images.length}`);
        worksheet.model.images.forEach((img, idx) => {
          console.log(`  Image ${idx + 1}:`, {
            range: img.range,
            type: img.type,
            position: img.position,
            width: img.width,
            height: img.height
          });
        });
      } else {
        console.log(`\n🖼️ No images found in this sheet`);
      }
    });

    console.log('\n✅ Analysis complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
