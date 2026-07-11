'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCampusStore } from '../../stores/campusStore';
import { calculateStudioPlacement } from '../../selectors/campus-layout';
import { assignDesks, locationPosition } from '../../selectors/studio-layout';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import type { ProjectRow } from '../../lib/types';

interface Shot {
  sig: string;
  camera: THREE.Vector3;
  target: THREE.Vector3;
}

function studioWorldCenter(index: number): { center: THREE.Vector3; outward: THREE.Vector3 } {
  const p = calculateStudioPlacement(index);
  return {
    center: new THREE.Vector3(p.position[0], 1.4, p.position[2]),
    outward: new THREE.Vector3(p.outward[0], 0, p.outward[1]).normalize(),
  };
}

function agentWorldPosition(projects: ProjectRow[], agentId: string): THREE.Vector3 | null {
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i]!;
    const assigned = assignDesks(project.agents);
    const entry = assigned.find((a) => a.agent.id === agentId);
    if (!entry) continue;
    const loc = selectStudioLocation(selectAgentVisualState(entry.agent));
    const local = locationPosition(loc, entry.deskIndex, 0, 1);
    const placement = calculateStudioPlacement(i);
    const v = new THREE.Vector3(local[0], 1.1, local[2]);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY);
    v.add(new THREE.Vector3(placement.position[0], 0, placement.position[2]));
    return v;
  }
  return null;
}

/** Camera with overview / project-focus / agent-follow modes. Transitions are eased and
 * interruptible: grabbing the orbit controls cancels an in-flight move. */
export function CampusCameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraState = useCampusStore((s) => s.camera);
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const projectIds = projectList.map((p) => p.id);

  const shotRef = useRef<Shot | null>(null);
  const activeSigRef = useRef<string>('');
  const progressRef = useRef(1);

  // cancel an in-flight transition when the user grabs the controls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    const cancel = () => {
      progressRef.current = 1;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, []);

  function computeShot(): Shot {
    if (cameraState.mode === 'follow' && cameraState.followedAgentId) {
      const pos = agentWorldPosition(projectList, cameraState.followedAgentId);
      if (pos) {
        const outwardIndex = projectIds.indexOf(
          projectList.find((p) => p.agents.some((a) => a.id === cameraState.followedAgentId))?.id ?? '',
        );
        const outward =
          outwardIndex >= 0 ? studioWorldCenter(outwardIndex).outward : new THREE.Vector3(0, 0, 1);
        const cam = pos.clone().add(outward.clone().multiplyScalar(9)).add(new THREE.Vector3(0, 7, 0));
        return { sig: `follow:${cameraState.followedAgentId}`, camera: cam, target: pos };
      }
    }

    if (cameraState.mode === 'room' && cameraState.focusedProjectId) {
      const index = projectIds.indexOf(cameraState.focusedProjectId);
      if (index >= 0) {
        const { center, outward } = studioWorldCenter(index);
        const cam = center.clone().add(outward.clone().multiplyScalar(17)).add(new THREE.Vector3(0, 12, 0));
        return { sig: `room:${cameraState.focusedProjectId}`, camera: cam, target: center.clone().setY(1.2) };
      }
    }

    // overview: frame the centroid of the hub + all studios so the campus stays centred
    // no matter how few studios there are or which wedge they occupy.
    const points = [new THREE.Vector3(0, 0, 0)];
    for (let i = 0; i < projectList.length; i += 1) {
      const p = calculateStudioPlacement(i).position;
      points.push(new THREE.Vector3(p[0], 0, p[2]));
    }
    const centroid = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const spread = Math.max(16, ...points.map((p) => p.distanceTo(centroid))) + 10;
    const dist = spread * 1.7 + 16;
    // corner-isometric: whole floating island centred, rooms and agents still read big
    return {
      sig: 'overview',
      camera: centroid.clone().add(new THREE.Vector3(dist * 0.42, dist * 0.72, dist * 0.56)),
      target: centroid.clone().setY(3),
    };
  }

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const shot = computeShot();

    if (shot.sig !== activeSigRef.current) {
      activeSigRef.current = shot.sig;
      shotRef.current = shot;
      progressRef.current = 0;
    } else {
      shotRef.current = shot; // keep target fresh (e.g. followed agent moving)
    }

    const current = shotRef.current;
    if (current && progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.6);
      const e = easeInOut(progressRef.current);
      camera.position.lerp(current.camera, e * 0.2 + 0.02);
      controls.target.lerp(current.target, e * 0.2 + 0.02);
    } else if (current && cameraState.mode === 'follow') {
      // keep the pivot on the moving agent, but let the user orbit freely around it
      controls.target.lerp(current.target, Math.min(1, delta * 2));
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={6}
      maxDistance={400}
    />
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
