'use client';

import { Html } from '@react-three/drei';
import { HTML_Z_RANGE, STATE_COLOR, STATE_LABEL } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';

/**
 * Floating label: agent name + role, and a status line. When the agent is doing ambient
 * idle life the status line shows the ambient activity in amber and is tagged so it never
 * reads as real Claude work. Full detail lives in the inspector drawer.
 */
export function AgentLabel({
  name,
  role,
  state,
  ambientLabel,
  resting = false,
  selected,
}: {
  name: string;
  role?: string | null;
  state: SimplifiedAgentVisualState;
  ambientLabel?: string | null;
  resting?: boolean;
  selected: boolean;
}) {
  // Resting (cosmetic) reads before ambient/state -- a slate dot + "Resting · zzz".
  const dotColor = resting ? '#8a93a0' : ambientLabel ? '#e0a94a' : STATE_COLOR[state];
  const textColor = resting ? '#aeb6c0' : ambientLabel ? '#f2c877' : '#cdd3db';
  const statusText = resting ? 'Resting · zzz' : ambientLabel ? `${ambientLabel} · ambient` : STATE_LABEL[state];
  return (
    <Html position={[0, 2.35, 0]} center distanceFactor={16} pointerEvents="none" zIndexRange={HTML_Z_RANGE}>
      <div
        style={{
          minWidth: 0,
          padding: '3px 9px',
          borderRadius: 9,
          background: selected ? 'rgba(56,140,220,0.92)' : 'rgba(15,17,23,0.74)',
          color: '#fff',
          fontSize: 11,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          lineHeight: 1.25,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          {role && <span style={{ color: '#aeb6c0', fontSize: 9.5 }}>· {role}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }} />
          <span style={{ color: textColor, fontSize: 9.5 }}>{statusText}</span>
        </div>
      </div>
    </Html>
  );
}
