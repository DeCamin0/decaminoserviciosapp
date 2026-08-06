import { randomUUID } from 'crypto';

const SKIP_NAMES = new Set([
  'thumbs.db',
  '.ds_store',
  'desktop.ini',
  '__macosx',
]);

const MEDIA_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.jfif',
  '.jpe',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.bmp',
  '.tif',
  '.tiff',
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.3gp',
  '.m4v',
  '.mpg',
  '.mpeg',
]);

const DEFAULT_ALBUM = 'Sin carpeta de servicio';

export function normalizeClientName(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(comunidad\s+de\s+propietarios|c\.?\s*p\.?|cp)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mimeFromFileName(name: string): string {
  const ext = (
    name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  ).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.3gp': 'video/3gpp',
    '.m4v': 'video/mp4',
  };
  return map[ext] || 'application/octet-stream';
}

export function isMediaFileName(name: string): boolean {
  const base = name.split(/[/\\]/).pop() || name;
  if (SKIP_NAMES.has(base.toLowerCase())) return false;
  if (base.startsWith('.')) return false;
  const ext = base.includes('.')
    ? base.slice(base.lastIndexOf('.')).toLowerCase()
    : '';
  return MEDIA_EXT.has(ext);
}

function tokens(s: string): Set<string> {
  return new Set(s.split(' ').filter((t) => t.length > 1));
}

/** Jaccard-ish overlap score 0..1 between two normalized names. */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.75 + 0.25 * (shorter / longer);
  }
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

export type MatchCandidate = {
  id: number;
  nombre: string;
  nif: string | null;
  score: number;
};

export type FolderMatchResult = {
  folder: string;
  status: 'exact' | 'fuzzy' | 'ambiguous' | 'none';
  suggested_cliente_id: number | null;
  candidates: MatchCandidate[];
};

export function matchFolderToClientes(
  folderName: string,
  clientes: Array<{
    id: number;
    nombre: string | null;
    nif?: string | null;
  }>,
): FolderMatchResult {
  const norm = normalizeClientName(folderName);
  if (!norm) {
    return {
      folder: folderName,
      status: 'none',
      suggested_cliente_id: null,
      candidates: [],
    };
  }

  const scored: MatchCandidate[] = [];
  for (const c of clientes) {
    const cn = normalizeClientName(c.nombre || '');
    if (!cn) continue;
    const score = nameSimilarity(norm, cn);
    if (score >= 0.35) {
      scored.push({
        id: c.id,
        nombre: c.nombre || '',
        nif: c.nif ?? null,
        score: Math.round(score * 1000) / 1000,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8);

  if (!top.length) {
    return {
      folder: folderName,
      status: 'none',
      suggested_cliente_id: null,
      candidates: [],
    };
  }

  const best = top[0];
  const second = top[1];
  if (best.score >= 0.92 && (!second || best.score - second.score >= 0.08)) {
    return {
      folder: folderName,
      status: 'exact',
      suggested_cliente_id: best.id,
      candidates: top,
    };
  }
  if (best.score >= 0.55 && (!second || best.score - second.score >= 0.12)) {
    return {
      folder: folderName,
      status: 'fuzzy',
      suggested_cliente_id: best.id,
      candidates: top,
    };
  }
  if (best.score >= 0.45) {
    return {
      folder: folderName,
      status: 'ambiguous',
      suggested_cliente_id: null,
      candidates: top,
    };
  }
  return {
    folder: folderName,
    status: 'none',
    suggested_cliente_id: null,
    candidates: top,
  };
}

export type ImportFileEntry = {
  relativePath: string;
  /** Absolute path on disk when from ZIP job; empty for browser-only preview */
  diskPath?: string;
  size?: number;
  mime?: string;
};

export type ImportAlbumPreview = {
  album_title: string;
  files: Array<{ name: string; relativePath: string; size: number }>;
  file_count: number;
};

export type ImportClientPreview = {
  folder: string;
  match: FolderMatchResult;
  albumes: ImportAlbumPreview[];
  file_count: number;
};

/**
 * Build import tree from relative paths.
 * Supports optional common root (e.g. FotosTrabajo/).
 * `knownTopFolders` = all community folders seen in ZIP (even empty / no media).
 */
export function buildImportTree(
  entries: ImportFileEntry[],
  clientes: Array<{ id: number; nombre: string | null; nif?: string | null }>,
  knownTopFolders: string[] = [],
): {
  clients: ImportClientPreview[];
  skipped: number;
  stats: {
    top_folders_total: number;
    with_media: number;
    without_media: number;
    media_files: number;
  };
} {
  const media = entries.filter((e) => {
    const name = e.relativePath.replace(/\\/g, '/');
    if (name.includes('__MACOSX/')) return false;
    const base = name.split('/').pop() || '';
    return isMediaFileName(base);
  });

  const partsList = media.map((e) =>
    e.relativePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean),
  );

  /** Strip common wrapper folder (FotosTrabajo) when present on most paths. */
  let strip = 0;
  if (partsList.length) {
    const counts = new Map<string, number>();
    for (const p of partsList) {
      const s = (p[0] || '').toLowerCase();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    let best = '';
    let bestN = 0;
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    const ratio = bestN / partsList.length;
    if (
      ratio >= 0.6 &&
      /foto|trabajo|fotos|import/i.test(best) &&
      partsList.filter((p) => p[0]?.toLowerCase() === best && p.length >= 2)
        .length >=
        partsList.length * 0.5
    ) {
      strip = 1;
    }
  }

  type AccAlbum = {
    title: string;
    files: Array<{
      name: string;
      relativePath: string;
      size: number;
      diskPath?: string;
      mime?: string;
    }>;
  };
  const byClient = new Map<string, Map<string, AccAlbum>>();

  let skipped = entries.length - media.length;

  for (let i = 0; i < media.length; i++) {
    const e = media[i];
    let parts = partsList[i];
    if (
      strip === 1 &&
      parts[0] &&
      /foto|trabajo|fotos|import/i.test(parts[0])
    ) {
      parts = parts.slice(1);
    }
    if (parts.length < 2) {
      // file at root — skip
      skipped += 1;
      continue;
    }
    const clientFolder = parts[0];
    let albumTitle: string;
    let fileName: string;
    if (parts.length === 2) {
      albumTitle = DEFAULT_ALBUM;
      fileName = parts[1];
    } else {
      albumTitle = parts.slice(1, -1).join(' / ');
      fileName = parts[parts.length - 1];
    }
    if (!byClient.has(clientFolder)) byClient.set(clientFolder, new Map());
    const albums = byClient.get(clientFolder)!;
    if (!albums.has(albumTitle)) {
      albums.set(albumTitle, { title: albumTitle, files: [] });
    }
    albums.get(albumTitle)!.files.push({
      name: fileName,
      relativePath: e.relativePath.replace(/\\/g, '/'),
      size: e.size || 0,
      diskPath: e.diskPath,
      mime: e.mime || mimeFromFileName(fileName),
    });
  }

  /** Normalize known top folders (also strip wrapper if needed). */
  const topSet = new Set<string>();
  for (const raw of knownTopFolders) {
    let name = String(raw || '').trim();
    if (!name || name === '__MACOSX') continue;
    if (strip === 1 && /foto|trabajo|fotos|import/i.test(name)) continue;
    topSet.add(name);
  }
  for (const folder of byClient.keys()) topSet.add(folder);

  const clients: ImportClientPreview[] = [];
  for (const folder of topSet) {
    const albumsMap = byClient.get(folder) || new Map();
    const albumes: ImportAlbumPreview[] = [];
    let fileCount = 0;
    for (const album of albumsMap.values()) {
      fileCount += album.files.length;
      albumes.push({
        album_title: album.title,
        files: album.files.map((f) => ({
          name: f.name,
          relativePath: f.relativePath,
          size: f.size,
        })),
        file_count: album.files.length,
      });
    }
    albumes.sort((a, b) => a.album_title.localeCompare(b.album_title));
    clients.push({
      folder,
      match: matchFolderToClientes(folder, clientes),
      albumes,
      file_count: fileCount,
    });
  }
  clients.sort((a, b) => a.folder.localeCompare(b.folder));

  const withMedia = clients.filter((c) => c.file_count > 0).length;
  return {
    clients,
    skipped,
    stats: {
      top_folders_total: clients.length,
      with_media: withMedia,
      without_media: clients.length - withMedia,
      media_files: media.length,
    },
  };
}

export function newImportJobId(): string {
  return randomUUID();
}

export { DEFAULT_ALBUM };
