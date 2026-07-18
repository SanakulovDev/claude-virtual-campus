'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { AmbientActivity } from '@campus/contracts';
import { agentBodyColor, PALETTE, STATE_COLOR } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';
import { routeBetween } from '../../selectors/routing';
import { laneFor } from '../../selectors/office-layout';
import { AgentLabel } from './AgentLabel';
import type { AgentRow } from '../../lib/types';

interface AgentAvatarProps {
  agent: AgentRow;
  visualState: SimplifiedAgentVisualState;
  ambient: AmbientActivity | null;
  resting?: boolean;
  /** World-space destination. The avatar routes itself there via the hallway. */
  target: [number, number, number];
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Hair variants keep teammates individual without a model library. */
function Hair({ variant, color }: { variant: number; color: string }) {
  if (variant === 0) {
    return (
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    );
  }
  if (variant === 1) {
    return (
      <group>
        <mesh position={[0, 1.87, -0.02]} castShadow>
          <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0.12, 1.78, -0.1]} castShadow>
          <boxGeometry args={[0.08, 0.16, 0.16]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[0, 1.95, -0.16]} castShadow>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * Low-poly office person. Shirt colour = role tint; skin/hair are stable per agent id.
 * Position comes from walking a hallway waypoint route to the current destination; pose
 * comes from the simplified visual state. Ambient life is labelled and cosmetic only.
 */
export function AgentAvatar({ agent, visualState, ambient, resting = false, target, restFacingY, selected, onSelect, onFollow }: AgentAvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const pathRef = useRef<THREE.Vector3[]>([]);
  const legRef = useRef(0);
  // Mount position only -- after mount, useFrame owns position; a reactive
  // position prop would snap the group to each new destination and skip the walk.
  const initialPosition = useRef<[number, number, number]>(target);

  const shirt = agentBodyColor(agent.agentType, agent.externalAgentId);
  const seedHash = hashString(agent.id);
  const skin = PALETTE.skinTones[seedHash % PALETTE.skinTones.length]!;
  const hairColor = PALETTE.hairColors[(seedHash >> 3) % PALETTE.hairColors.length]!;
  const hairVariant = seedHash % 3;
  const isMain = agent.externalAgentId === 'main-claude' || agent.agentType === 'main-claude';
  const lane = useMemo(() => laneFor(agent.id), [agent.id]);

  // New destination -> new route from wherever we are right now.
  useEffect(() => {
    const g = root.current;
    const from: [number, number, number] = g
      ? [g.position.x, 0, g.position.z]
      : [target[0], 0, target[2]];
    pathRef.current = routeBetween(from, target, lane).map((p) => new THREE.Vector3(p[0], 0, p[2]));
    legRef.current = 0;
  }, [target[0], target[2], lane]);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;

    // walk the waypoint path
    let moving = false;
    const path = pathRef.current;
    if (legRef.current < path.length) {
      const waypoint = path[legRef.current]!;
      const dist = g.position.distanceTo(waypoint);
      if (dist < 0.15 && legRef.current < path.length - 1) legRef.current += 1;
      if (dist > 0.08) {
        moving = true;
        g.position.lerp(waypoint, Math.min(1, delta * 3.2));
        const dir = waypoint.clone().sub(g.position);
        if (dir.lengthSq() > 0.0001) {
          g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dir.x, dir.z), delta * 6);
        }
      }
    }

    if (!moving) {
      if (resting) g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 3);
      else if (ambient) g.rotation.y = dampAngle(g.rotation.y, restFacingY + Math.sin(t * 0.8) * 0.35, delta * 3);
      else g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 5);
    }

    const seated = !moving && !resting && !ambient && (visualState === 'working' || visualState === 'checking');
    const targetY = resting
      ? -0.42 + Math.sin(t * 0.9) * 0.03
      : seated ? -0.28
      : ambient && !moving ? Math.sin(t * 1.6) * 0.05
      : 0;
    if (torso.current) {
      torso.current.position.y = THREE.MathUtils.lerp(torso.current.position.y, targetY, Math.min(1, delta * 6));
      if (visualState === 'completed' && !resting) torso.current.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
    }

    // legs swing only while walking
    if (leftLeg.current && rightLeg.current) {
      const swing = moving ? Math.sin(t * 9) * 0.55 : 0;
      leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, swing, Math.min(1, delta * 8));
      rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, -swing, Math.min(1, delta * 8));
    }

    if (leftArm.current && rightArm.current) {
      if (moving) {
        leftArm.current.rotation.x = -Math.sin(t * 9) * 0.45;
        rightArm.current.rotation.x = Math.sin(t * 9) * 0.45;
      } else if (resting) {
        leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0.15, Math.min(1, delta * 4));
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0.15, Math.min(1, delta * 4));
      } else if (ambient) {
        const s = Math.sin(t * 1.4) * 0.2;
        leftArm.current.rotation.x = -0.2 + s;
        rightArm.current.rotation.x = -0.2 - s;
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

    if (beacon.current) {
      const on = visualState === 'attention';
      beacon.current.visible = on;
      if (on) beacon.current.position.y = 2.05 + Math.sin(t * 4) * 0.08;
    }
  });

  const statusColor = STATE_COLOR[visualState];
  const glow = resting ? 0.12 : 1;

  return (
    <group
      ref={root}
      position={initialPosition.current}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onFollow(); }}
    >
      <group ref={torso}>
        {/* legs: hip-pivot groups so they swing while walking */}
        {[-0.13, 0.13].map((x, i) => (
          <group key={x} ref={i === 0 ? leftLeg : rightLeg} position={[x, 0.72, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
              <meshStandardMaterial color={PALETTE.pants} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.56, 0.06]} castShadow>
              <boxGeometry args={[0.16, 0.1, 0.3]} />
              <meshStandardMaterial color="#2f2a26" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* shirt torso (role tint) */}
        <RoundedBox args={[0.52, 0.62, 0.32]} radius={0.1} smoothness={4} position={[0, 1.12, 0]} castShadow>
          <meshStandardMaterial color={shirt} roughness={0.9} />
        </RoundedBox>

        {/* arms: shirt sleeve + skin hand */}
        <mesh ref={leftArm} position={[-0.33, 1.28, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.9} />
          <mesh position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
        </mesh>
        <mesh ref={rightArm} position={[0.33, 1.28, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.9} />
          <mesh position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
        </mesh>

        {/* head + hair */}
        <mesh position={[0, 1.68, 0]} castShadow>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <Hair variant={hairVariant} color={hairColor} />

        {/* status pin on the chest -- carries the live state colour */}
        <mesh position={[0.16, 1.32, 0.17]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.9 * glow} toneMapped={false} />
        </mesh>

        {isMain && (
          <mesh position={[0, 2.0, 0]}>
            <torusGeometry args={[0.14, 0.025, 8, 16]} />
            <meshStandardMaterial color="#e8b23c" emissive="#e8b23c" emissiveIntensity={0.4} />
          </mesh>
        )}
      </group>

      <mesh ref={beacon} position={[0, 2.05, 0]} visible={false}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={STATE_COLOR.attention} emissive={STATE_COLOR.attention} emissiveIntensity={1} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.54, 28]} />
          <meshBasicMaterial color="#3aa0f0" />
        </mesh>
      )}

      <AgentLabel name={agent.displayName} role={agent.role} state={visualState} ambientLabel={ambient?.label ?? null} resting={resting} selected={selected} />
    </group>
  );
}

function dampAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}
