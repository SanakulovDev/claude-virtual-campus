'use client';

import { Html } from '@react-three/drei';
import { HTML_Z_RANGE } from '../../lib/theme';
import { STUDIO_ANCHORS } from '../../selectors/studio-layout';

/** Floating project name over the studio. Name + accent dot only -- no path / remote / ids. */
export function StudioSign({
  name,
  accent,
  tech,
  onSelect,
}: {
  name: string;
  accent: string;
  tech: string;
  onSelect: () => void;
}) {
  const [sx, sy, sz] = STUDIO_ANCHORS.sign;
  return (
    <Html position={[sx, sy + 1.4, sz]} center distanceFactor={26} zIndexRange={HTML_Z_RANGE}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          background: 'rgba(15,17,23,0.82)',
          color: '#f2f4f7',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, flex: 'none' }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
        {tech && <span style={{ fontSize: 11, color: '#aeb6c2' }}>{tech}</span>}
      </button>
    </Html>
  );
}
