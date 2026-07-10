'use client';

import { Html } from '@react-three/drei';
import { STATE_COLOR, STATE_LABEL } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';

/** Minimal floating label: agent name + short state only. Full detail lives in the drawer. */
export function AgentLabel({
  name,
  state,
  selected,
}: {
  name: string;
  state: SimplifiedAgentVisualState;
  selected: boolean;
}) {
  return (
    <Html position={[0, 2.35, 0]} center distanceFactor={16} pointerEvents="none">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          borderRadius: 8,
          background: selected ? 'rgba(56,140,220,0.92)' : 'rgba(15,17,23,0.72)',
          color: '#fff',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{name}</span>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: STATE_COLOR[state] }} />
        <span style={{ color: '#cdd3db', fontSize: 10 }}>{STATE_LABEL[state]}</span>
      </div>
    </Html>
  );
}
