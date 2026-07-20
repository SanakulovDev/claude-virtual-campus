export type ParsedLine = { type: string; payload: unknown };

export function parseStreamLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const type = typeof (payload as { type?: unknown })?.type === 'string' ? (payload as { type: string }).type : 'unknown';
  return { type, payload };
}

export function clampPayload(payload: unknown, maxBytes: number): unknown {
  const bytes = Buffer.byteLength(JSON.stringify(payload) ?? '', 'utf8');
  if (bytes <= maxBytes) return payload;
  const type = typeof (payload as { type?: unknown })?.type === 'string' ? (payload as { type: string }).type : 'unknown';
  return { truncated: true, type, bytes };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function extractSessionId(event: unknown): string | null {
  const id = (event as { session_id?: unknown })?.session_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export interface RunOutcome {
  status: 'COMPLETED' | 'FAILED';
  resultText: string | null;
  costUsd: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  usageJson: unknown | null;
  sessionId: string | null;
}

export function extractOutcome(event: unknown): RunOutcome {
  const e = (event ?? {}) as Record<string, unknown>;
  const usage = (e.usage ?? null) as Record<string, unknown> | null;
  const cost = num(e.total_cost_usd);
  return {
    status: e.is_error ? 'FAILED' : 'COMPLETED',
    resultText: typeof e.result === 'string' ? e.result : null,
    costUsd: cost === null ? null : String(cost),
    durationMs: num(e.duration_ms),
    inputTokens: usage ? num(usage.input_tokens) : null,
    outputTokens: usage ? num(usage.output_tokens) : null,
    cacheReadTokens: usage ? num(usage.cache_read_input_tokens) : null,
    cacheCreationTokens: usage ? num(usage.cache_creation_input_tokens) : null,
    usageJson: usage,
    sessionId: extractSessionId(event),
  };
}
