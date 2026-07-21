import { afterEach, describe, expect, it } from 'vitest';
import { allowNonLoopbackRuns, isLoopbackHost, resolveCorsOrigins } from './api-host';

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

describe('resolveCorsOrigins', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it('splits a comma-separated list and trims whitespace', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3200, http://127.0.0.1:3200';
    expect(resolveCorsOrigins()).toEqual(['http://localhost:3200', 'http://127.0.0.1:3200']);
  });

  it('falls back to the dev default when unset', () => {
    expect(resolveCorsOrigins()).toEqual(['http://localhost:3000']);
  });
});

describe('allowNonLoopbackRuns', () => {
  afterEach(() => {
    delete process.env.RUNS_ALLOW_NONLOOPBACK;
  });

  it('is off by default', () => {
    expect(allowNonLoopbackRuns()).toBe(false);
  });

  it('requires the exact value "1", not any truthy string', () => {
    process.env.RUNS_ALLOW_NONLOOPBACK = 'true';
    expect(allowNonLoopbackRuns()).toBe(false);
    process.env.RUNS_ALLOW_NONLOOPBACK = '1';
    expect(allowNonLoopbackRuns()).toBe(true);
  });
});
