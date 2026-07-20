import { describe, expect, it } from 'vitest';
import { parseStreamLine, clampPayload, extractOutcome, extractSessionId } from './stream-parser';

describe('parseStreamLine', () => {
  it('parses a json line', () => {
    expect(parseStreamLine('{"type":"assistant","x":1}')).toEqual({ type: 'assistant', payload: { type: 'assistant', x: 1 } });
  });
  it('skips blank and unparseable lines', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('   ')).toBeNull();
    expect(parseStreamLine('not json')).toBeNull();
  });
  it('defaults a missing type to "unknown"', () => {
    expect(parseStreamLine('{"foo":1}')).toEqual({ type: 'unknown', payload: { foo: 1 } });
  });
});

describe('clampPayload', () => {
  it('passes small payloads through', () => {
    expect(clampPayload({ a: 1 }, 1000)).toEqual({ a: 1 });
  });
  it('replaces oversize payloads with a truncation marker', () => {
    const big = { type: 'assistant', blob: 'x'.repeat(500) };
    const out = clampPayload(big, 100) as { truncated: boolean; type: string; bytes: number };
    expect(out.truncated).toBe(true);
    expect(out.type).toBe('assistant');
    expect(out.bytes).toBeGreaterThan(100);
  });
});

describe('extractSessionId', () => {
  it('reads session_id from an init system event', () => {
    expect(extractSessionId({ type: 'system', subtype: 'init', session_id: 'sess-1' })).toBe('sess-1');
  });
  it('returns null when absent', () => {
    expect(extractSessionId({ type: 'assistant' })).toBeNull();
  });
});

describe('extractOutcome', () => {
  it('maps a successful result event', () => {
    const o = extractOutcome({
      type: 'result', subtype: 'success', is_error: false, result: 'done',
      total_cost_usd: 0.0123, duration_ms: 4200, session_id: 'sess-1',
      usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 2 },
    });
    expect(o.status).toBe('COMPLETED');
    expect(o.resultText).toBe('done');
    expect(o.costUsd).toBe('0.0123');
    expect(o.durationMs).toBe(4200);
    expect(o.inputTokens).toBe(10);
    expect(o.outputTokens).toBe(20);
    expect(o.cacheReadTokens).toBe(5);
    expect(o.cacheCreationTokens).toBe(2);
    expect(o.sessionId).toBe('sess-1');
  });
  it('maps an error result event to FAILED', () => {
    const o = extractOutcome({ type: 'result', is_error: true, result: 'nope' });
    expect(o.status).toBe('FAILED');
    expect(o.resultText).toBe('nope');
  });
});
