'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { agentBodyColor, PALETTE, STATE_COLOR } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';
import { AgentLabel } from './AgentLabel';
import type { AgentRow } from '../../lib/types';

interface AgentAvatarProps {
  agent: AgentRow;
  visualState: SimplifiedAgentVisualState;
  target: [number, number, number];
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}

/**
 * Rounded low-poly avatar. Position/facing come only from the agent's committed studio
 * location; pose comes only from its simplified visual state -- there is no idle fake work.
 */
export function AgentAvatar({ agent, visualState, target, restFacingY, selected, onSelect, onFollow }: AgentAvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const targetVec = useMemo(() => new THREE.Vector3(...target), [target]);
  const bodyColor = agentBodyColor(agent.agentType, agent.externalAgentId);
  const isMain = agent.externalAgentId === 'main-claude' || agent.agentType === 'main-claude';

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;

    // move toward committed target, frame-rate independent
    const before = g.position.distanceTo(targetVec);
    g.position.lerp(targetVec, Math.min(1, delta * 3.2));
    const moving = before > 0.08;

    // face movement direction while walking, otherwise settle to the location's rest facing
    if (moving) {
      const dir = targetVec.clone().sub(g.position);
      if (dir.lengthSq() > 0.0001) {
        const angle = Math.atan2(dir.x, dir.z);
        g.rotation.y = dampAngle(g.rotation.y, angle, delta * 6);
      }
    } else {
      g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 5);
    }

    const seated = !moving && (visualState === 'working' || visualState === 'checking');
    // seated vs standing height
    const targetY = seated ? -0.28 : 0;
    if (torso.current) {
      torso.current.position.y = THREE.MathUtils.lerp(torso.current.position.y, targetY, Math.min(1, delta * 6));
      // celebration hop
      if (visualState === 'completed') {
        torso.current.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
      }
    }

    // arm animation by state
    if (leftArm.current && rightArm.current) {
      if (moving) {
        leftArm.current.rotation.x = Math.sin(t * 8) * 0.5;
        rightArm.current.rotation.x = -Math.sin(t * 8) * 0.5;
      } else if (visualState === 'working') {
        const typ = Math.sin(t * 9) * 0.15;
        leftArm.current.rotation.x = -1.1 + typ;
        rightArm.current.rotation.x = -1.1 - typ;
      } else if (visualState === 'checking' || visualState === 'planning') {
        leftArm.current.rotation.x = -0.4;
        rightArm.current.rotation.x = -0.4;
      } else if (visualState === 'completed') {
        leftArm.current.rotation.x = -2.6;
        rightArm.current.rotation.x = -2.6;
      } else {
        leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, delta * 5);
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, delta * 5);
      }
    }

    // attention beacon pulse
    if (beacon.current) {
      const on = visualState === 'attention';
      beacon.current.visible = on;
      if (on) beacon.current.position.y = 2.05 + Math.sin(t * 4) * 0.08;
    }
  });

  const statusColor = STATE_COLOR[visualState];

  return (
    <group
      ref={root}
      position={target}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onFollow();
      }}
    >
      <group ref={torso}>
        {/* legs */}
        <mesh position={[-0.16, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
          <meshStandardMaterial color="#4a5160" roughness={0.9} />
        </mesh>
        <mesh position={[0.16, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
          <meshStandardMaterial color="#4a5160" roughness={0.9} />
        </mesh>
        {/* torso (rounded) */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.5, 6, 12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
        {/* accent collar */}
        <mesh position={[0, 1.2, 0]}>
          <torusGeometry args={[0.3, 0.05, 8, 20]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.3} />
        </mesh>
        {/* arms */}
        <mesh ref={leftArm} position={[-0.38, 1.15, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
        <mesh ref={rightArm} position={[0.38, 1.15, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color={PALETTE.avatarSkin} roughness={0.85} />
        </mesh>
        {/* main-claude gets a subtle crown ring */}
        {isMain && (
          <mesh position={[0, 1.86, 0]}>
            <torusGeometry args={[0.16, 0.03, 8, 16]} />
            <meshStandardMaterial color="#e8b23c" emissive="#e8b23c" emissiveIntensity={0.4} />
          </mesh>
        )}
      </group>

      {/* attention beacon */}
      <mesh ref={beacon} position={[0, 2.05, 0]} visible={false}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={STATE_COLOR.attention} emissive={STATE_COLOR.attention} emissiveIntensity={1} />
      </mesh>

      {/* selection ring */}
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.54, 28]} />
          <meshBasicMaterial color="#3aa0f0" />
        </mesh>
      )}

      <AgentLabel name={agent.displayName} state={visualState} selected={selected} />
    </group>
  );
}

function dampAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}
