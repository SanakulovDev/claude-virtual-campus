import { describe, expect, it } from 'vitest';
import { redactSensitiveData } from './redact';

describe('redactSensitiveData', () => {
  it('redacts values under secret-shaped keys', () => {
    const result = redactSensitiveData({ password: 'hunter2', api_key: 'abc', normal: 'ok' }) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.normal).toBe('ok');
  });

  it('redacts bearer tokens embedded in strings', () => {
    const result = redactSensitiveData({ header: 'Authorization: Bearer abc.def.ghi' }) as Record<string, unknown>;
    expect(result.header).not.toContain('abc.def.ghi');
  });

  it('drops prototype-polluting keys', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
    const result = redactSensitiveData(malicious) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('truncates very long strings', () => {
    const result = redactSensitiveData({ big: 'x'.repeat(10000) }) as Record<string, unknown>;
    expect((result.big as string).length).toBeLessThan(5000);
  });
});
