import { describe, expect, it } from 'vitest';
import { corsOrigins } from '../src/cors';

describe('corsOrigins', () => {
  it('keeps a single configured origin as a string', () => {
    expect(corsOrigins('http://localhost:3100')).toBe('http://localhost:3100');
  });

  it('parses and trims an explicit origin allowlist', () => {
    expect(corsOrigins('http://localhost:3100, http://localhost:3200')).toEqual([
      'http://localhost:3100',
      'http://localhost:3200',
    ]);
  });
});
