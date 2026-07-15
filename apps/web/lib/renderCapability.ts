export type RenderCapability = 'full' | 'fallback';

type RendererContext = Pick<
  WebGLRenderingContext,
  'getContextAttributes' | 'getExtension' | 'getParameter'
>;

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

/**
 * Classify the Canvas' existing context. Never create a probe context here: constrained
 * browsers may only provide one viable WebGL context and can evict the real renderer.
 */
export function detectRenderCapability(gl: RendererContext | null | undefined): RenderCapability {
  if (typeof window === 'undefined') return 'fallback';
  try {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowFx = new URLSearchParams(window.location.search).has('lowfx');
    if (reducedMotion || lowFx || !gl || gl.getContextAttributes() === null) return 'fallback';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return classifyRenderer(renderer);
  } catch {
    return 'fallback';
  }
}
