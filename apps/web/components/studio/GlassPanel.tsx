'use client';

import { useMemo } from 'react';
import { detectRenderCapability } from '../../lib/renderCapability';

/**
 * Capability-gated glass mesh. `detectRenderCapability()` probes the WebGL renderer once
 * per mount: real GPUs get `meshPhysicalMaterial` transmission (proper refraction), software
 * renderers (SwiftShader/llvmpipe/headless) get a cheap frosted `meshStandardMaterial` so
 * screenshots and low-power browsers never pay for transmission passes they can't render well.
 */
export function GlassPanel(
  props: JSX.IntrinsicElements['mesh'] & { size: [number, number, number]; tint?: string },
) {
  const cap = useMemo(() => detectRenderCapability(), []);
  const { size, tint = '#bcd4e0', ...mesh } = props;
  return (
    <mesh {...mesh}>
      <boxGeometry args={size} />
      {cap === 'full' ? (
        <meshPhysicalMaterial
          transmission={0.9}
          thickness={0.4}
          roughness={0.15}
          ior={1.3}
          transparent
          opacity={0.6}
          color={tint}
        />
      ) : (
        <meshStandardMaterial transparent opacity={0.28} color={tint} roughness={0.4} />
      )}
    </mesh>
  );
}
