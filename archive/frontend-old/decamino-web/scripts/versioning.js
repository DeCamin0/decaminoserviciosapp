#!/usr/bin/env node
/**
 * Lightweight version bumping utility for web/mobile pipelines.
 * Non-intrusive: only edits package.json and a local .mobile/versionCode file.
 *
 * Usage:
 *   node scripts/versioning.js [patch|minor|major]
 */
import fs from 'fs';
import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function bumpSemver(version, type) {
  const [maj, min, pat] = String(version).split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${(pat || 0) + 1}`;
}

const semverBump = process.argv[2] || 'patch';
const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = readJson(pkgPath);

const newVersion = bumpSemver(pkg.version || '1.0.0', semverBump);
pkg.version = newVersion;
writeJson(pkgPath, pkg);

// Maintain a local Android-like versionCode counter for future mobile builds
const mobileDir = path.resolve(process.cwd(), '.mobile');
const vcFile = path.join(mobileDir, 'versionCode');
fs.mkdirSync(mobileDir, { recursive: true });
let vc = 0;
if (fs.existsSync(vcFile)) {
  const raw = fs.readFileSync(vcFile, 'utf8').trim();
  vc = Number.parseInt(raw, 10) || 0;
}
vc += 1;
fs.writeFileSync(vcFile, String(vc));

console.log(`✔ Version bumped to ${newVersion} (local versionCode=${vc})`);


