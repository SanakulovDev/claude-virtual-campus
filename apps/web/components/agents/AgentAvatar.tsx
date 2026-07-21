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
  /** World-space destination. The robot routes itself there via the hallway. */
  target: [number, number, number];
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}

/** Constant glide speed in world units/s. Every robot moves at the same pace regardless of
 * how far away its destination is -- distance-proportional lerp made far robots sprint and
 * near robots crawl, which read as agents "not knowing what they're doing". */
const GLIDE_SPEED = 3.4;
/** Chassis hover height above the floor. */
const HOVER_Y = 0.52;

/**
 * Hover robot. Plating is neutral; the glowing visor is the single in-scene status surface
 * (color = simplified visual state). Pose changes are minimal and mechanical: forward lean
 * while gliding, manipulators raised at a desk, powered-down slump when resting.
 */
export function AgentAvatar({ agent, visualState, ambient, resting = false, target, restFacingY, selected, onSelect, onFollow }: AgentAvatarProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const visorMat = useRef<THREE.MeshStandardMaterial>(null);

  const pathRef = useRef<THREE.Vector3[]>([]);
  const legRef = useRef(0);
  // Mount position only -- after mount, useFrame owns position; a reactive
  // position prop would snap the group to each new destination and skip the glide.
  const initialPosition = useRef<[number, number, number]>(target);

  const roleTint = agentBodyColor(agent.agentType, agent.externalAgentId);
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

    // Glide the waypoint path at constant speed.
    let moving = false;
    const path = pathRef.current;
    if (legRef.current < path.length) {
      const waypoint = path[legRef.current]!;
      const dist = g.position.distanceTo(waypoint);
      const step = GLIDE_SPEED * delta;
      if (dist <= step) {
        g.position.copy(waypoint);
        if (legRef.current < path.length - 1) moving = true;
        legRef.current += 1;
      } else {
        moving = true;
        const dir = waypoint.clone().sub(g.position).normalize();
        g.position.addScaledVector(dir, step);
        g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dir.x, dir.z), delta * 8);
      }
    }

    if (!moving) {
      g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 5);
    }

    if (body.current) {
      // Hover bob: calm at rest, firmer while gliding; resting settles toward the floor.
      const bob = resting ? 0 : Math.sin(t * (moving ? 7 : 1.6) + g.position.x) * (moving ? 0.05 : 0.03);
      const baseY = resting ? -0.34 : 0;
      body.current.position.y = THREE.MathUtils.lerp(body.current.position.y, baseY + bob, Math.min(1, delta * 6));
      if (visualState === 'completed' && !resting) body.current.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
      // Forward lean while gliding, upright otherwise.
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, moving ? 0.14 : 0, Math.min(1, delta * 6));
    }

    if (leftArm.current && rightArm.current) {
      let l = 0;
      let r = 0;
      if (moving) {
        l = 0.35; r = 0.35; // manipulators tucked back while gliding
      } else if (resting) {
        l = 0; r = 0;
      } else if (visualState === 'working') {
        const typ = Math.sin(t * 9) * 0.12;
        l = -1.05 + typ; r = -1.05 - typ; // at the console
      } else if (visualState === 'checking' || visualState === 'planning') {
        l = -0.5; r = -0.5;
      } else if (visualState === 'completed') {
        l = -2.4; r = -2.4;
      }
      leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, l, Math.min(1, delta * 7));
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, r, Math.min(1, delta * 7));
    }

    if (ring.current) {
      ring.current.rotation.z = t * (moving ? 2.4 : 0.5);
    }

    if (visorMat.current) {
      // Attention pulses; everything else holds a steady glow. Resting dims the optic.
      const base = resting ? 0.15 : visualState === 'idle' ? 0.55 : 1.4;
      visorMat.current.emissiveIntensity =
        visualState === 'attention' && !resting ? 1.2 + Math.sin(t * 8) * 0.7 : base;
    }

    if (beacon.current) {
      const on = visualState === 'attention' && !resting;
      beacon.current.visible = on;
      if (on) beacon.current.position.y = 2.15 + Math.sin(t * 4) * 0.08;
    }
  });

  const statusColor = STATE_COLOR[visualState];

  return (
    <group
      ref={root}
      position={initialPosition.current}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onFollow(); }}
    >
      <group ref={body} scale={1.18}>
        {/* hover ring: anti-grav skirt under the chassis */}
        <mesh ref={ring} position={[0, HOVER_Y - 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.045, 8, 24]} />
          <meshStandardMaterial
            color={PALETTE.robotDark}
            emissive={statusColor}
            emissiveIntensity={resting ? 0.05 : 0.35}
          />
        </mesh>

        {/* chassis */}
        <RoundedBox args={[0.56, 0.6, 0.38]} radius={0.09} smoothness={4} position={[0, HOVER_Y + 0.5, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.robotPlating} roughness={0.55} metalness={0.25} />
        </RoundedBox>
        {/* chest core: secondary status light */}
        <mesh position={[0, HOVER_Y + 0.56, 0.2]}>
          <cylinderGeometry args={[0.055, 0.055, 0.03, 12]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={resting ? 0.1 : 0.9} toneMapped={false} />
        </mesh>
        {/* shoulder markings: role tint */}
        {[-0.31, 0.31].map((x) => (
          <mesh key={x} position={[x, HOVER_Y + 0.72, 0]} castShadow>
            <boxGeometry args={[0.1, 0.1, 0.3]} />
            <meshStandardMaterial color={roleTint} roughness={0.6} />
          </mesh>
        ))}

        {/* manipulators */}
        <mesh ref={leftArm} position={[-0.36, HOVER_Y + 0.62, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          <meshStandardMaterial color={PALETTE.robotJoint} roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh ref={rightArm} position={[0.36, HOVER_Y + 0.62, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          <meshStandardMaterial color={PALETTE.robotJoint} roughness={0.7} metalness={0.3} />
        </mesh>

        {/* neck + head */}
        <mesh position={[0, HOVER_Y + 0.86, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.1, 10]} />
          <meshStandardMaterial color={PALETTE.robotJoint} roughness={0.7} metalness={0.3} />
        </mesh>
        <RoundedBox args={[0.4, 0.3, 0.34]} radius={0.07} smoothness={4} position={[0, HOVER_Y + 1.06, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.robotPlating} roughness={0.55} metalness={0.25} />
        </RoundedBox>
        {/* visor: the status surface */}
        <mesh position={[0, HOVER_Y + 1.06, 0.16]}>
          <boxGeometry args={[0.28, 0.1, 0.04]} />
          <meshStandardMaterial
            ref={visorMat}
            color={PALETTE.visorBase}
            emissive={statusColor}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>

        {isMain && (
          <group position={[0, HOVER_Y + 1.24, 0]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
              <meshStandardMaterial color={PALETTE.robotJoint} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial color={PALETTE.accent} emissive={PALETTE.accent} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>

      <mesh ref={beacon} position={[0, 2.15, 0]} visible={false}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color={STATE_COLOR.attention} emissive={STATE_COLOR.attention} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 28]} />
          <meshBasicMaterial color={PALETTE.accent} />
        </mesh>
      )}

      <AgentLabel name={agent.displayName} selected={selected} />
    </group>
  );
}

function dampAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}
