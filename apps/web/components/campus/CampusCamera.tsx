'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCampusStore } from '../../stores/campusStore';
import { calculateRoomPosition } from '@campus/contracts';

/** Finds an agent's approximate world position across all projects, for follow mode. */
function findAgentWorldPosition(
  projects: ReturnType<typeof useCampusStore.getState>['projects'],
  agentId: string,
): THREE.Vector3 | null {
  const projectList = Object.values(projects);
  for (let i = 0; i < projectList.length; i += 1) {
    const project = projectList[i]!;
    const agent = project.agents.find((a) => a.id === agentId);
    if (agent) {
      const pos = calculateRoomPosition(projectList.indexOf(project));
      return new THREE.Vector3(pos.x, 1.2, pos.z + 1);
    }
  }
  return null;
}

export function CampusCamera() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraState = useCampusStore((s) => s.camera);
  const projects = useCampusStore((s) => s.projects);
  const projectIds = Object.keys(projects);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (cameraState.mode === 'follow' && cameraState.followedAgentId) {
      const worldPos = findAgentWorldPosition(projects, cameraState.followedAgentId);
      if (worldPos) {
        const desiredCamera = worldPos.clone().add(new THREE.Vector3(4, 4, 6));
        camera.position.lerp(desiredCamera, Math.min(1, delta * 2));
        controls.target.lerp(worldPos, Math.min(1, delta * 2));
      }
    } else if (cameraState.mode === 'room' && cameraState.focusedProjectId) {
      const index = projectIds.indexOf(cameraState.focusedProjectId);
      if (index >= 0) {
        const pos = calculateRoomPosition(index);
        const target = new THREE.Vector3(pos.x, 0, pos.z);
        const desiredCamera = target.clone().add(new THREE.Vector3(0, 10, 12));
        camera.position.lerp(desiredCamera, Math.min(1, delta * 2));
        controls.target.lerp(target, Math.min(1, delta * 2));
      }
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      maxPolarAngle={Math.PI / 2.1}
      minDistance={4}
      maxDistance={120}
    />
  );
}
