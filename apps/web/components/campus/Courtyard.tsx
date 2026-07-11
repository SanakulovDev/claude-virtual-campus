'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { COURTYARD_ANCHORS } from '../../selectors/campus-world-layout';

/** Outdoor hub: nav ground (flat), sports court, dining tables, glowing walkways. */
export function Courtyard({ onNavGround }: { onNavGround?: (geom: THREE.BufferGeometry) => void }) {
  const ground = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ground.current && onNavGround) onNavGround(ground.current.geometry as THREE.BufferGeometry);
  }, [onNavGround]);

  return (
    <group>
      {/* flat nav ground covering the central courtyard (fed to three-pathfinding) */}
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
        <planeGeometry args={[34, 34, 1, 1]} />
        <meshStandardMaterial color="#cfd4cc" roughness={1} />
      </mesh>

      {/* sports court */}
      <group position={COURTYARD_ANCHORS.sport}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <planeGeometry args={[4, 2.6]} />
          <meshStandardMaterial color="#3f6f5f" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.05, 1, 2.6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* dining/lounge */}
      <group position={COURTYARD_ANCHORS.dining}>
        {[-1.2, 1.2].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <cylinderGeometry args={[0.6, 0.6, 0.08, 16]} />
              <meshStandardMaterial color="#d7cfc1" />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.7, 8]} />
              <meshStandardMaterial color="#9c917f" />
            </mesh>
          </group>
        ))}
      </group>

      {/* walkways: courtyard -> ring (four glowing paths) */}
      {[0, 90, 180, 270].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} rotation={[-Math.PI / 2, 0, r]} position={[Math.sin(r) * 12, 0.07, Math.cos(r) * 12]}>
            <planeGeometry args={[2.2, 14]} />
            <meshStandardMaterial color="#9fb6c9" emissive="#3a6ea5" emissiveIntensity={0.15} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}
