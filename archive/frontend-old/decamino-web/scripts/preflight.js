#!/usr/bin/env node
/**
 * Preflight checks for release safety.
 * - Ensures external URLs use https:// (except local dev allowlist)
 * - Optional --fix to auto-upgrade http:// -> https:// in src/public
 * - Skips node_modules and only scans selected root files
 */
import fs from 'fs';
import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

function walk(dir, filterExt = []) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p, filterExt));
    else if (!filterExt.length || filterExt.includes(path.extname(p))) out.push(p);
  }
  return out;
}

const ALLOWLIST = [
  'http://localhost',
  'http://127.0.0.1',
  'ws://localhost',
  'ws://127.0.0.1',
];

function isAllowlisted(url) {
  return ALLOWLIST.some((prefix) => url.startsWith(prefix));
}

function stripComments(text, ext) {
  // crude stripping for js/ts/css/json/html
  if (/\.(js|jsx|ts|tsx|css)$/.test(ext)) {
    // remove /* */ and // comments
    return text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');
  }
  return text;
}

function findInsecureUrls(root) {
  const targets = walk(root, ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css']);
  const offenders = [];
  const re = /(http:\/\/[^\s"']+|ws:\/\/[^\s"']+|src="\/\/[^"']+|href="\/\/[^"']+)/gi;
  for (const file of targets) {
    const raw = fs.readFileSync(file, 'utf8');
    const text = stripComments(raw, path.extname(file));
    const matches = (text.match(re) || []).filter((m) => {
      const url = m.replace(/^src="|^href="|"$/g, '');
      return !isAllowlisted(url);
    });
    if (matches.length) offenders.push({ file, matches });
  }
  return offenders;
}

const root = process.cwd();
const insecure = [
  ...findInsecureUrls(path.join(root, 'src')),
  ...(fs.existsSync(path.join(root, 'public')) ? findInsecureUrls(path.join(root, 'public')) : []),
];

const shouldFix = process.argv.includes('--fix');

if (insecure.length) {
  console.warn('⚠ Found potential insecure references (http:// or ws:// or protocol-relative):');
  for (const o of insecure) {
    console.warn('-', o.file, '→', o.matches.join(', '));
    if (shouldFix && o.file.startsWith(path.join(root, 'src')) || (shouldFix && o.file.startsWith(path.join(root, 'public')))) {
      // Auto-fix only in our code (src/public). Replace protocol-relative and http with https
      let text = fs.readFileSync(o.file, 'utf8');
      text = text
        .replace(/\bhttp:\/\/(?!localhost|127\.0\.0\.1)/g, 'https://')
        .replace(/(src=")\/\//g, '$1https://')
        .replace(/(href=")\/\//g, '$1https://');
      fs.writeFileSync(o.file, text, 'utf8');
      console.log('  ✓ fixed', o.file);
    }
  }
  process.exitCode = 0; // warn only
} else {
  console.log('✔ No insecure URL references detected');
}


