#!/usr/bin/env node
/**
 * Converts frontend/public/logo.svg to backend/assets/logo.png for PDF generation.
 * Run from repo root: node backend/scripts/convert-logo-to-png.js
 * Or from backend: node scripts/convert-logo-to-png.js
 */
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const svgPath = path.join(repoRoot, 'frontend', 'public', 'logo.svg');
const outDir = path.join(repoRoot, 'backend', 'assets');
const outPath = path.join(outDir, 'logo.png');

if (!fs.existsSync(svgPath)) {
  console.error('No se encontró', svgPath);
  process.exit(1);
}
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Instala sharp en backend: cd backend && npm install sharp --save-dev');
  process.exit(1);
}

async function run() {
  try {
    await sharp(fs.readFileSync(svgPath))
      .png({ quality: 100 })
      .toFile(outPath);
    console.log('OK logo.png generado en', outPath);
  } catch (err) {
    console.error('Error convirtiendo logo:', err.message);
    process.exit(1);
  }
}
run();
