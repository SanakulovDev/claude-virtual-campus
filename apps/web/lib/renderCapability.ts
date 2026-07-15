export type RenderCapability = 'full' | 'fallback';

const SOFTWARE_MARKERS = /swiftshader|software|llvmpipe|microsoft basic render/i;

export function classifyRenderer(
  rendererString: string,
  opts: { reducedMotion?: boolean; lowFx?: boolean } = {},
): RenderCapability {
  if (opts.reducedMotion || opts.lowFx) return 'fallback';
  // Unknown/blocked renderer (e.g. headless probe can't read WEBGL_debug_renderer_info) is
  // treated as fallback -- assuming 'full' would run bloom on software WebGL and render black.
  if (!rendererString.trim()) return 'fallback';
  return SOFTWARE_MARKERS.test(rendererString) ? 'fallback' : 'full';
}

/** Browser-only probe. Returns 'fallback' on any failure so headless/software WebGL is safe. */
export function detectRenderCapability(): RenderCapability {
  if (typeof window === 'undefined') return 'fallback';
  try {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowFx = new URLSearchParams(window.location.search).has('lowfx');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return 'fallback';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return classifyRenderer(renderer, { reducedMotion, lowFx });
  } catch {
    return 'fallback';
  }
}
