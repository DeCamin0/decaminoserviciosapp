import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Citește package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Generează o versiune bazată pe timestamp
const now = new Date();
const version = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

// Actualizează versiunea în package.json
packageJson.version = version;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// Actualizează versiunea în index.html
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
indexContent = indexContent.replace(/data-version="[^"]*"/, `data-version="${version}"`);
fs.writeFileSync(indexPath, indexContent);

console.log(`✅ Version updated to: ${version}`);
