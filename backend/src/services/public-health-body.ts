export function publicHealthBody(now: Date): {
  status: 'ok';
  timestamp: string;
} {
  return { status: 'ok', timestamp: now.toISOString() };
}

export function publicDbHealthBody(input: {
  ok: boolean;
  latencyMs?: number;
}): { ok: boolean; latencyMs?: number } {
  if (!input.ok) return { ok: false };
  return { ok: true, latencyMs: input.latencyMs ?? 0 };
}
