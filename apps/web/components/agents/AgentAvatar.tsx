'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentActivity } from '@campus/contracts';
import type { AgentRow } from '../../lib/types';

const ACTIVITY_COLOR: Record<AgentActivity, string> = {
  idle: '#6b7280',
  planning: '#a78bfa',
  walking: '#93c5fd',
  researching: '#38bdf8',
  coding: '#34d399',
  testing: '#fbbf24',
  building: '#fb923c',
  reviewing: '#c084fc',
  formatting: '#4ade80',
  running_command: '#94a3b8',
  managing_database: '#f472b6',
  managing_infrastructure: '#f87171',
  meeting: '#a78bfa',
  waiting_approval: '#f43f5e',
  blocked: '#ef4444',
  failed: '#dc2626',
  completed: '#22c55e',
};

const ROLE_COLOR: Record<string, string> = {
  'main-claude': '#e2e8f0',
};

interface AgentAvatarProps {
  agent: AgentRow;
  targetPosition: [number, number, number];
  selected: boolean;
  onSelect: () => void;
}

/** Procedural low-poly humanoid; movement/animation are entirely driven by real agent state. */
export function AgentAvatar({ agent, targetPosition, selected, onSelect }: AgentAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const bodyColor = ROLE_COLOR[agent.agentType] ?? '#cbd5e1';
  const statusColor = ACTIVITY_COLOR[agent.activity] ?? '#6b7280';
  const isWalking = agent.activity === 'walking';
  const isWorking = ['coding', 'testing', 'building', 'researching', 'reviewing', 'formatting', 'running_command', 'managing_database', 'managing_infrastructure'].includes(agent.activity);

  const target = useMemo(() => new THREE.Vector3(...targetPosition), [targetPosition]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.position.lerp(target, Math.min(1, delta * 3));
    const dir = target.clone().sub(g.position);
    if (dir.lengthSq() > 0.001) {
      const angle = Math.atan2(dir.x, dir.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, angle, Math.min(1, delta * 5));
    }
    if (isWalking) {
      g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 6)) * 0.05;
    } else if (isWorking) {
      g.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.02;
    } else {
      g.position.y = 0;
    }
  });

  return (
    <group ref={group} position={targetPosition} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* legs */}
      <mesh position={[-0.12, 0.3, 0]} castShadow>
        <boxGeometry args={[0.14, 0.6, 0.14]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      <mesh position={[0.12, 0.3, 0]} castShadow>
        <boxGeometry args={[0.14, 0.6, 0.14]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.24]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.3, 0.75, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0.3, 0.75, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      {/* status indicator */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 24]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      )}
      <Html position={[0, 1.7, 0]} center distanceFactor={10} occlude>
        <div style={{ fontSize: 11, color: 'white', background: 'rgba(15,17,23,0.75)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
          {agent.displayName}
        </div>
      </Html>
    </group>
  );
}
