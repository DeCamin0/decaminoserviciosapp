import { randomUUID } from 'crypto';
import type { BuildObjectKeyInput } from './storage.types';

/** Strip path separators and unsafe characters for object key suffixes. */
export function safeFileName(originalName: string, fallback = 'file'): string {
  const base = (originalName || fallback).split(/[/\\]/).pop() || fallback;
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return cleaned || fallback;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Canonical R2 key:
 * `{app}/{tenant}/{domain}/{scope_id}/{yyyy}/{mm}/{uuid}__{safeName}.{ext}`
 *
 * `scopeId` may include `/` path segments (e.g. `templates/Limpiador`,
 * `employees/emp_1/original`); each segment is sanitized separately.
 */
export function buildObjectKey(input: BuildObjectKeyInput): string {
  const at = input.at ?? new Date();
  const yyyy = String(at.getUTCFullYear());
  const mm = pad2(at.getUTCMonth() + 1);
  const id = input.uuid ?? randomUUID();

  let safeName = 'file';
  let ext = (input.ext || '').replace(/^\./, '').toLowerCase();

  if (input.originalName) {
    const safe = safeFileName(input.originalName);
    const dot = safe.lastIndexOf('.');
    if (dot > 0) {
      safeName = safe.slice(0, dot);
      if (!ext) ext = safe.slice(dot + 1).toLowerCase();
    } else {
      safeName = safe;
    }
  }

  const filePart = ext ? `${id}__${safeName}.${ext}` : `${id}__${safeName}`;

  const scopeParts = String(input.scopeId || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  return [
    input.app,
    input.tenant,
    input.domain,
    ...scopeParts,
    yyyy,
    mm,
    filePart,
  ]
    .map((p) =>
      String(p)
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '_'),
    )
    .join('/');
}
