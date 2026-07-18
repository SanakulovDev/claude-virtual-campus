import { describe, expect, it } from 'vitest';
import { isLoopbackHost } from './api-host';

describe('isLoopbackHost', () => {
  it('accepts loopback binds', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
  });

  it('rejects exposed binds', () => {
    expect(isLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLoopbackHost('::')).toBe(false);
    expect(isLoopbackHost('192.168.1.20')).toBe(false);
  });
});
