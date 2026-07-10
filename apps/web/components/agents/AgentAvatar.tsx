'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { profileForAgentType, type AgentAccessory, type AmbientActivity } from '@campus/contracts';
import { agentBodyColor, PALETTE, STATE_COLOR } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';
import { AgentLabel } from './AgentLabel';
import type { AgentRow } from '../../lib/types';

interface AgentAvatarProps {
  agent: AgentRow;
  visualState: SimplifiedAgentVisualState;
  ambient: AmbientActivity | null;
  target: [number, number, number];
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}

const HAIR_COLORS = ['#3b2f2a', '#5a3a26', '#20242b', '#6b6b6b', '#8a5a2b', '#c9a24b'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Small role accessory rendered near the head/chest. One reusable set, not a new model. */
function Accessory({ kind, accent }: { kind: AgentAccessory; accent: string }) {
  switch (kind) {
    case 'headphones':
      return (
        <group>
          <mesh position={[0, 1.78, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.28, 0.035, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
          <mesh position={[-0.27, 1.62, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
          <mesh position={[0.27, 1.62, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
        </group>
      );
    case 'glasses':
      return (
        <group position={[0, 1.6, 0.22]}>
          <mesh position={[-0.1, 0, 0]}>
            <torusGeometry args={[0.07, 0.014, 6, 14]} />
            <meshStandardMaterial color="#20242b" />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <torusGeometry args={[0.07, 0.014, 6, 14]} />
            <meshStandardMaterial color="#20242b" />
          </mesh>
        </group>
      );
    case 'notebook':
      return (
        <mesh position={[0.1, 1.06, 0.3]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.26, 0.34, 0.04]} />
          <meshStandardMaterial color="#c9762e" />
        </mesh>
      );
    case 'clipboard':
      return (
        <group position={[0.1, 1.06, 0.32]} rotation={[0.5, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.28, 0.36, 0.03]} />
            <meshStandardMaterial color="#e7e2d6" />
          </mesh>
          <mesh position={[0, 0.16, 0.03]}>
            <boxGeometry args={[0.12, 0.06, 0.03]} />
            <meshStandardMaterial color="#8a8f98" />
          </mesh>
        </group>
      );
    case 'shield':
      return (
        <mesh position={[0.24, 1.12, 0.28]}>
          <cylinderGeometry args={[0.11, 0.09, 0.04, 6]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
        </mesh>
      );
    case 'tablet':
      return (
        <mesh position={[0.1, 1.04, 0.32]} rotation={[0.6, 0, 0]}>
          <boxGeometry args={[0.3, 0.22, 0.02]} />
          <meshStandardMaterial color="#1d2733" emissive="#2b6cb0" emissiveIntensity={0.4} />
        </mesh>
      );
    default:
      return null;
  }
}

/**
 * Rounded low-poly office character. Position/facing come from the agent's committed studio
 * location; work pose comes from its simplified visual state. When the agent is genuinely
 * idle and ambient life is on it does a soft sway -- clearly labelled ambient, never fake work.
 */
export function AgentAvatar({ agent, visualState, ambient, target, restFacingY, selected, onSelect, onFollow }: AgentAvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const targetVec = useMemo(() => new THREE.Vector3(...target), [target]);
  const bodyColor = agentBodyColor(agent.agentType, agent.externalAgentId);
  const isMain = agent.externalAgentId === 'main-claude' || agent.agentType === 'main-claude';
  const accessory = profileForAgentType(agent.agentType).accessory;
  const hairColor = HAIR_COLORS[hashString(agent.id) % HAIR_COLORS.length]!;
  const hairStyle = hashString(agent.id + 'h') % 3;

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;

    const before = g.position.distanceTo(targetVec);
    g.position.lerp(targetVec, Math.min(1, delta * 3.2));
    const moving = before > 0.08;

    if (moving) {
      const dir = targetVec.clone().sub(g.position);
      if (dir.lengthSq() > 0.0001) {
        const angle = Math.atan2(dir.x, dir.z);
        g.rotation.y = dampAngle(g.rotation.y, angle, delta * 6);
      }
    } else if (ambient) {
      // gentle idle-life sway so ambient agents read as alive, not frozen
      g.rotation.y = dampAngle(g.rotation.y, restFacingY + Math.sin(t * 0.8) * 0.35, delta * 3);
    } else {
      g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 5);
    }

    const seated = !moving && !ambient && (visualState === 'working' || visualState === 'checking');
    const targetY = seated ? -0.28 : ambient && !moving ? Math.sin(t * 1.6) * 0.05 : 0;
    if (torso.current) {
      torso.current.position.y = THREE.MathUtils.lerp(torso.current.position.y, targetY, Math.min(1, delta * 6));
      if (visualState === 'completed') {
        torso.current.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
      }
    }

    if (leftArm.current && rightArm.current) {
      if (moving) {
        leftArm.current.rotation.x = Math.sin(t * 8) * 0.5;
        rightArm.current.rotation.x = -Math.sin(t * 8) * 0.5;
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
        {/* shoes */}
        <mesh position={[-0.16, 0.06, 0.06]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.3]} />
          <meshStandardMaterial color="#2b2f36" roughness={0.8} />
        </mesh>
        <mesh position={[0.16, 0.06, 0.06]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.3]} />
          <meshStandardMaterial color="#2b2f36" roughness={0.8} />
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
        {/* arms + hands */}
        <mesh ref={leftArm} position={[-0.38, 1.15, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
          <mesh position={[0, -0.28, 0]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color={PALETTE.avatarSkin} roughness={0.85} />
          </mesh>
        </mesh>
        <mesh ref={rightArm} position={[0.38, 1.15, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
          <mesh position={[0, -0.28, 0]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color={PALETTE.avatarSkin} roughness={0.85} />
          </mesh>
        </mesh>
        {/* head */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color={PALETTE.avatarSkin} roughness={0.85} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.09, 1.63, 0.23]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#20242b" />
        </mesh>
        <mesh position={[0.09, 1.63, 0.23]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#20242b" />
        </mesh>
        {/* hair (variant by agent) */}
        {!isMain && (
          <group>
            <mesh position={[0, 1.73, -0.02]} scale={[1, hairStyle === 2 ? 0.7 : 0.85, 1]} castShadow>
              <sphereGeometry args={[0.28, 16, 16]} />
              <meshStandardMaterial color={hairColor} roughness={0.9} />
            </mesh>
            {hairStyle === 1 && (
              <mesh position={[0, 1.68, 0.2]} scale={[1, 0.4, 0.4]}>
                <sphereGeometry args={[0.24, 12, 12]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
            {hairStyle === 2 && (
              <mesh position={[0, 1.95, -0.05]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
          </group>
        )}
        {/* main-claude gets a subtle crown ring */}
        {isMain && (
          <mesh position={[0, 1.86, 0]}>
            <torusGeometry args={[0.16, 0.03, 8, 16]} />
            <meshStandardMaterial color="#e8b23c" emissive="#e8b23c" emissiveIntensity={0.4} />
          </mesh>
        )}
        <Accessory kind={accessory} accent={statusColor} />
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

      <AgentLabel name={agent.displayName} role={agent.role} state={visualState} ambientLabel={ambient?.label ?? null} selected={selected} />
    </group>
  );
}

function dampAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}
