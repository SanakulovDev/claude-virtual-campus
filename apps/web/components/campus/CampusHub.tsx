'use client';

import { useRef } from 'react';
import { RoundedBox, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { HTML_Z_RANGE, PALETTE } from '../../lib/theme';

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 2.2, 8]} />
        <meshStandardMaterial color={PALETTE.pot} roughness={1} />
      </mesh>
      <mesh position={[0, 2.7, 0]} castShadow>
        <icosahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial color={PALETTE.foliage} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function Bench({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[2.4, 0.25, 0.7]} radius={0.08} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.deskWood} roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

/** Central shared plaza the studios ring around. Gentle raised platform, a slow-rotating
 * sculpture, trees and benches -- a calm anchor, not a workflow station. */
export function CampusHub() {
  const sculptureRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (sculptureRef.current) sculptureRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
        <circleGeometry args={[20, 48]} />
        <meshStandardMaterial color={PALETTE.hubPlatform} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[19.2, 20, 48]} />
        <meshStandardMaterial color={PALETTE.hubAccent} roughness={1} />
      </mesh>

      <RoundedBox args={[3, 0.6, 3]} radius={0.12} position={[0, 0.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.studioTrim} roughness={0.9} />
      </RoundedBox>
      <mesh ref={sculptureRef} position={[0, 2, 0]} castShadow>
        <icosahedronGeometry args={[1.6, 0]} />
        <meshStandardMaterial color="#8fa0b8" roughness={0.4} metalness={0.15} flatShading />
      </mesh>

      <Html position={[0, 4.4, 0]} center distanceFactor={40} pointerEvents="none" zIndexRange={HTML_Z_RANGE}>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(15,17,23,0.72)',
            color: '#eef1f5',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
            whiteSpace: 'nowrap',
          }}
        >
          Claude Virtual Campus
        </div>
      </Html>

      <Tree position={[13, 0, 6]} />
      <Tree position={[-12, 0, -8]} />
      <Tree position={[8, 0, -13]} />
      <Bench position={[-9, 0, 9]} rotationY={0.6} />
      <Bench position={[10, 0, -6]} rotationY={-1.1} />
    </group>
  );
}
