/**
 * Importă ítems din foaia ITEMS a fișierului PRESUPUESTO DECAMINO 2025 (1).xlsm
 * în tabelul informes_items.
 *
 * Rulează din backend: node scripts/import-informes-items-from-excel.js
 * Sau din root: node backend/scripts/import-informes-items-from-excel.js (cu DATABASE_URL în backend/.env)
 *
 * Opțiuni: --dry-run (doar afișează ce s-ar insera), --truncate (șterge înainte toate rândurile din informes_items)
 */
const path = require('path');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const xlsmPath = path.join(__dirname, '..', '..', 'PRESUPUESTO DECAMINO 2025 (1).xlsm');

function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  const v = cell.value;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object') {
    if (v.result !== undefined && v.result !== null) return v.result;
    if (v.richText && Array.isArray(v.richText)) return v.richText.map((t) => t.text || '').join('').trim() || null;
    if (v.text) return String(v.text).trim() || null;
  }
  return String(v).trim() || null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const truncate = args.includes('--truncate');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsmPath);
  const sheet = workbook.getWorksheet('ITEMS');
  if (!sheet) {
    console.error('Foaia ITEMS nu există în Excel.');
    process.exit(1);
  }

  const rowCount = sheet.rowCount || 0;
  const rows = [];
  for (let r = 2; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const itemId = getCellValue(row.getCell(1));
    const nombre = getCellValue(row.getCell(2));
    const descripcion = getCellValue(row.getCell(3));
    const precioRaw = getCellValue(row.getCell(4));
    const observaciones = getCellValue(row.getCell(5));

    if (!itemId && !nombre && precioRaw == null) continue;
    const precio = precioRaw != null ? Number(precioRaw) : 0;
    if (isNaN(precio)) continue;
    if (!nombre || nombre === '') continue;

    rows.push({
      item_id: String(itemId ?? `item-${r}`),
      nombre: String(nombre),
      descripcion: descripcion ? String(descripcion) : null,
      precio,
      observaciones: observaciones ? String(observaciones) : null,
    });
  }

  console.log(`Găsite ${rows.length} ítems în Excel (foaia ITEMS).`);

  if (dryRun) {
    rows.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.item_id} | ${r.nombre} | ${r.precio}`));
    if (rows.length > 5) console.log(`  ... și încă ${rows.length - 5}`);
    console.log('Dry-run: nu s-a inserat nimic.');
    return;
  }

  if (truncate) {
    const deleted = await prisma.informes_items.deleteMany({});
    console.log(`Șterse ${deleted.count} rânduri din informes_items.`);
  }

  const result = await prisma.$transaction(
    rows.map((row) =>
      prisma.informes_items.upsert({
        where: { item_id: row.item_id },
        create: row,
        update: { nombre: row.nombre, descripcion: row.descripcion, precio: row.precio, observaciones: row.observaciones },
      })
    ),
    { timeout: 60000 }
  );

  console.log(`Inserate/actualizate: ${result.length} ítems.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
