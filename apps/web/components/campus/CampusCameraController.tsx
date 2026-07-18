'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCampusStore } from '../../stores/campusStore';
import { useKioskMode } from '../../hooks/useKioskMode';
import { buildingBounds, roomPlacement, ROOM_W, ROOM_D } from '../../selectors/office-layout';
import { assignDesks } from '../../selectors/desk-assignment';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import { agentWorldTarget } from '../../selectors/agent-world-target';
import type { ProjectRow } from '../../lib/types';

const ISO_DIR = new THREE.Vector3(1, 1.15, 1).normalize();
const CAM_DIST = 120;

interface Shot { sig: string; target: THREE.Vector3; zoom: number }

function agentWorldPosition(projects: ProjectRow[], agentId: string): THREE.Vector3 | null {
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i]!;
    const entry = assignDesks(project.agents).find((a) => a.agent.id === agentId);
    if (!entry) continue;
    const loc = selectStudioLocation(selectAgentVisualState(entry.agent));
    const w = agentWorldTarget(loc, i, entry.deskIndex, 0, 1);
    return new THREE.Vector3(w[0], 1, w[2]);
  }
  return null;
}

/** Ortho zoom that fits a world-space box at the fixed iso angle, with margin. */
function fitZoom(size: { width: number; height: number }, minX: number, maxX: number, minZ: number, maxZ: number): number {
  const corners: THREE.Vector3[] = [];
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) for (const y of [0, 3]) corners.push(new THREE.Vector3(x, y, z));
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const camPos = center.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST));
  const view = new THREE.Matrix4().lookAt(camPos, center, new THREE.Vector3(0, 1, 0)).invert();
  let maxU = 0.001; let maxV = 0.001;
  for (const c of corners) {
    const p = c.clone().sub(center).applyMatrix4(view);
    maxU = Math.max(maxU, Math.abs(p.x));
    maxV = Math.max(maxV, Math.abs(p.y));
  }
  return Math.min(size.width / 2 / maxU, size.height / 2 / maxV) * 0.9;
}

/** Fixed-angle isometric camera with overview / room / follow modes. Transitions eased and
 * interruptible; grabbing the controls cancels an in-flight move. */
export function CampusCameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const cameraState = useCampusStore((s) => s.camera);
  const projects = useCampusStore((s) => s.projects);
  const kiosk = useKioskMode();
  const projectList = Object.values(projects);
  const projectIds = projectList.map((p) => p.id);

  const shotRef = useRef<Shot | null>(null);
  const activeSigRef = useRef('');
  const progressRef = useRef(1);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    const cancel = () => { progressRef.current = 1; };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, []);

  function computeShot(): Shot {
    if (cameraState.mode === 'follow' && cameraState.followedAgentId) {
      const pos = agentWorldPosition(projectList, cameraState.followedAgentId);
      if (pos) return { sig: `follow:${cameraState.followedAgentId}`, target: pos, zoom: 55 };
    }

    if (cameraState.mode === 'room' && cameraState.focusedProjectId) {
      const index = projectIds.indexOf(cameraState.focusedProjectId);
      if (index >= 0) {
        const p = roomPlacement(index);
        const zoom = fitZoom(size, p.center[0] - ROOM_W / 2 - 2, p.center[0] + ROOM_W / 2 + 2, p.center[2] - ROOM_D / 2 - 2, p.center[2] + ROOM_D / 2 + 2);
        return { sig: `room:${cameraState.focusedProjectId}:${size.width}x${size.height}`, target: new THREE.Vector3(p.center[0], 1, p.center[2]), zoom };
      }
    }

    const b = buildingBounds(projectList.length);
    const zoom = fitZoom(size, b.minX, b.maxX, b.minZ, b.maxZ);
    return {
      sig: `overview:${projectList.length}:${size.width}x${size.height}`,
      target: new THREE.Vector3((b.minX + b.maxX) / 2, 0, 0),
      zoom,
    };
  }

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const ortho = camera as THREE.OrthographicCamera;
    const shot = computeShot();

    if (shot.sig !== activeSigRef.current) {
      activeSigRef.current = shot.sig;
      shotRef.current = shot;
      progressRef.current = 0;
    } else {
      shotRef.current = shot;
    }

    const current = shotRef.current;
    if (current && progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.6);
      const e = easeInOut(progressRef.current) * 0.2 + 0.02;
      controls.target.lerp(current.target, e);
      ortho.position.lerp(current.target.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST)), e);
      ortho.zoom = THREE.MathUtils.lerp(ortho.zoom, current.zoom, e);
      ortho.updateProjectionMatrix();
    } else if (current && cameraState.mode === 'follow') {
      controls.target.lerp(current.target, Math.min(1, delta * 2));
      ortho.position.lerp(current.target.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST)), Math.min(1, delta * 2));
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enableRotate={!kiosk}
      enablePan={!kiosk}
      enableZoom={!kiosk}
      maxPolarAngle={Math.PI / 2.15}
    />
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
