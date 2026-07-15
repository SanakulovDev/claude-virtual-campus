'use client';

import { useRef } from 'react';
import { RoundedBox, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { HTML_Z_RANGE, PALETTE } from '../../lib/theme';
import { Courtyard } from './Courtyard';
import { buildCampusZone } from '../../lib/campusNav';

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

function AreaLabel({ text, y = 1.7 }: { text: string; y?: number }) {
  return (
    <Html position={[0, y, 0]} center distanceFactor={30} pointerEvents="none" zIndexRange={HTML_Z_RANGE}>
      <div
        style={{
          padding: '2px 8px',
          borderRadius: 7,
          background: 'rgba(15,17,23,0.6)',
          color: '#dfe4ea',
          fontSize: 10,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

/**
 * Lightweight shared campus areas. Purely decorative places that give idle agents somewhere
 * to belong -- coffee, games, garden, workshop, exercise, a sofa. Idle agents' ambient
 * activity references these; no real work or conversation ever happens here.
 */
function SharedAreas() {
  return (
    <group>
      {/* Coffee/Dining -- geometry now supplied by <Courtyard> (dining tables at the same
          anchor); keep only the label so we don't double-render props on top of it. */}
      <group position={[6, 0, 4]}>
        <AreaLabel text="☕ Coffee Area" />
      </group>

      {/* Game Table */}
      <group position={[-6, 0, 4]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.12, 16]} />
          <meshStandardMaterial color={PALETTE.planningTable} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 8]} />
          <meshStandardMaterial color={PALETTE.tableLeg} />
        </mesh>
        <mesh position={[0, 0.83, 0]}>
          <boxGeometry args={[0.6, 0.02, 0.6]} />
          <meshStandardMaterial color="#e7e2d6" />
        </mesh>
        <AreaLabel text="♟ Game Table" />
      </group>

      {/* Garden */}
      <group position={[0, 0, 8]}>
        {[
          [-0.6, 0, 0],
          [0.5, 0, 0.3],
          [0, 0, -0.5],
        ].map((p, i) => (
          <mesh key={i} position={[p[0]!, 0.4, p[2]!]} castShadow>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color={PALETTE.foliage} roughness={1} flatShading />
          </mesh>
        ))}
        <AreaLabel text="🌿 Garden" y={1.2} />
      </group>

      {/* Workshop Bench */}
      <group position={[-6, 0, -5]}>
        <RoundedBox args={[1.8, 0.2, 0.8]} radius={0.05} position={[0, 0.7, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.deskWoodDark} roughness={0.9} />
        </RoundedBox>
        <mesh position={[0.2, 0.95, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#9aa6b2" flatShading />
        </mesh>
        <AreaLabel text="🔧 Workshop Bench" />
      </group>

      {/* Exercise Area -- geometry now supplied by <Courtyard> (sports court at the same
          anchor); keep only the label so we don't double-render props on top of it. */}
      <group position={[6, 0, -5]}>
        <AreaLabel text="🏃 Exercise Area" y={0.9} />
      </group>

      {/* Plaza sofa */}
      <group position={[0, 0, -7]}>
        <RoundedBox args={[2.2, 0.5, 0.9]} radius={0.14} position={[0, 0.4, 0]} castShadow>
          <meshStandardMaterial color="#8695a6" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[2.2, 0.5, 0.25]} radius={0.12} position={[0, 0.65, -0.35]} castShadow>
          <meshStandardMaterial color="#8695a6" roughness={0.9} />
        </RoundedBox>
        <AreaLabel text="🛋 Campus Plaza" y={1.3} />
      </group>
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
          AI Virtual Campus
        </div>
      </Html>

      <Courtyard onNavGround={buildCampusZone} />
      <SharedAreas />

      <Tree position={[13, 0, 6]} />
      <Tree position={[-12, 0, -8]} />
      <Tree position={[8, 0, -13]} />
      <Bench position={[-11, 0, 9]} rotationY={0.6} />
      <Bench position={[11, 0, -9]} rotationY={-1.1} />
    </group>
  );
}
