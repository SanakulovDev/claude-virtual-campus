'use client';

import { Canvas } from '@react-three/fiber';
import { calculateRoomPosition } from '@campus/contracts';
import { CampusGround } from './CampusGround';
import { CampusCamera } from './CampusCamera';
import { ProjectRoom } from '../office/ProjectRoom';
import { useCampusStore } from '../../stores/campusStore';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);

  return (
    <Canvas shadows camera={{ position: [20, 20, 30], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={1} castShadow />
      <CampusGround />
      <CampusCamera />
      {projectList.map((project, index) => {
        const pos = calculateRoomPosition(index);
        return <ProjectRoom key={project.id} project={project} position={[pos.x, 0, pos.z]} />;
      })}
    </Canvas>
  );
}
