'use client';

import { Html } from '@react-three/drei';
import { HTML_Z_RANGE, PALETTE } from '../../lib/theme';
import { useKioskMode } from '../../hooks/useKioskMode';

/**
 * Robot nameplate: the agent's name and nothing else. Status lives on the visor/beacon in
 * the scene; full detail lives in the inspector drawer.
 */
export function AgentLabel({ name, selected }: { name: string; selected: boolean }) {
  const kiosk = useKioskMode();
  return (
    // No distanceFactor: with an orthographic camera drei scales it against ortho zoom and
    // the pill blows up to viewport size (the "black screen" that killed the previous
    // redesign attempt). Screen-space constant size is right for a fixed-zoom isometric camera.
    <Html position={[0, 2.2, 0]} center pointerEvents="none" zIndexRange={HTML_Z_RANGE}>
      <div
        style={{
          padding: '2px 7px',
          borderRadius: 4,
          border: `1px solid ${selected ? PALETTE.accent : 'rgba(255,255,255,0.14)'}`,
          background: 'rgba(10,13,18,0.82)',
          color: selected ? PALETTE.accent : '#dbe1e8',
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: kiosk ? 13 : 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
    </Html>
  );
}
