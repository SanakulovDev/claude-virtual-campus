import { describe, expect, it } from 'vitest';
import { classifyRenderer } from './renderCapability';

describe('classifyRenderer', () => {
  it('flags software renderers as fallback', () => {
    expect(classifyRenderer('Google SwiftShader')).toBe('fallback');
    expect(classifyRenderer('ANGLE (Software)')).toBe('fallback');
    expect(classifyRenderer('llvmpipe')).toBe('fallback');
  });
  it('treats real GPUs as full', () => {
    expect(classifyRenderer('Apple M2')).toBe('full');
    expect(classifyRenderer('ANGLE (Apple, Apple M2, OpenGL)')).toBe('full');
  });
  it('honours reduced-motion and a lowFx flag', () => {
    expect(classifyRenderer('Apple M2', { reducedMotion: true })).toBe('fallback');
    expect(classifyRenderer('Apple M2', { lowFx: true })).toBe('fallback');
  });
});
