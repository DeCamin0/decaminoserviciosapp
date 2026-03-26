/**
 * Generează PNG pătrat 512×512 (fundal alb, logo centrat) pentru manifest PWA.
 * Sursa logo-hera-solo.png e 2000×1000 → fără acest pas Edge/Chrome afișează literă „H” la instalare.
 */
import sharp from 'sharp';
import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const input = join(publicDir, 'logo-hera-solo.png');
const output = join(publicDir, 'logo-hera-pwa-512.png');

if (!existsSync(input)) {
  console.error('Lipsește fișierul:', input);
  process.exit(1);
}

if (existsSync(output) && existsSync(input)) {
  const outM = statSync(output).mtimeMs;
  const inM = statSync(input).mtimeMs;
  if (outM >= inM) {
    console.log('logo-hera-pwa-512.png la zi, skip.');
    process.exit(0);
  }
}

await sharp(input)
  .resize(512, 512, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 1 }
  })
  .png()
  .toFile(output);

console.log('OK →', output);
