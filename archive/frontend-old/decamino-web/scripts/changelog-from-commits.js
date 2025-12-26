#!/usr/bin/env node
/**
 * Generates/updates CHANGELOG.md using conventional commit-like grouping.
 *
 * Strategy:
 * - Determine range from last tag to HEAD (fallback to all commits)
 * - Group by feat|fix|chore|docs|refactor|perf|build|ci|test|revert|others
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function getRange() {
  try {
    const lastTag = sh('git describe --tags --abbrev=0');
    return { from: lastTag, to: 'HEAD', title: lastTag };
  } catch {
    return { from: '', to: 'HEAD', title: 'Unreleased' };
  }
}

function getCommits(range) {
  const format = '%H|%s';
  const cmd = range.from
    ? `git log ${range.from}..${range.to} --pretty=format:"${format}"`
    : `git log ${range.to} --pretty=format:"${format}"`;
  const out = sh(cmd);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('|');
      return { hash, subject };
    });
}

function categorize(subject) {
  const s = subject.toLowerCase();
  if (s.startsWith('feat')) return 'Features';
  if (s.startsWith('fix')) return 'Fixes';
  if (s.startsWith('perf')) return 'Performance';
  if (s.startsWith('refactor')) return 'Refactors';
  if (s.startsWith('docs')) return 'Docs';
  if (s.startsWith('build')) return 'Build';
  if (s.startsWith('ci')) return 'CI';
  if (s.startsWith('test')) return 'Tests';
  if (s.startsWith('chore')) return 'Chores';
  if (s.startsWith('revert')) return 'Reverts';
  return 'Others';
}

function renderSection(title, items) {
  if (!items.length) return '';
  const lines = items.map((c) => `- ${c.subject}`);
  return `\n### ${title}\n${lines.join('\n')}\n`;
}

function main() {
  const range = getRange();
  const commits = getCommits(range);
  const groups = new Map();
  for (const c of commits) {
    const g = categorize(c.subject);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }

  let content = `## ${range.title}\n`;
  const order = ['Features', 'Fixes', 'Performance', 'Refactors', 'Docs', 'Build', 'CI', 'Tests', 'Chores', 'Reverts', 'Others'];
  for (const key of order) {
    content += renderSection(key, groups.get(key) || []);
  }

  const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
  let previous = '';
  if (fs.existsSync(changelogPath)) previous = fs.readFileSync(changelogPath, 'utf8');

  const header = '# Changelog\n\n';
  const merged = header + content + (previous.replace(header, '\n') || '\n');
  fs.writeFileSync(changelogPath, merged);
  console.log('✔ CHANGELOG.md updated');
}

main();


