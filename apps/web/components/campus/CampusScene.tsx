'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusHub } from './CampusHub';
import { CampusCameraController } from './CampusCameraController';
import { ProjectStudio } from './ProjectStudio';
import { useCampusStore } from '../../stores/campusStore';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [42, 46, 52], fov: 42, near: 0.5, far: 600 }}
      onPointerMissed={() => deselect()}
      gl={{ antialias: true }}
    >
      <CampusEnvironment />
      <CampusCameraController />
      <CampusHub />
      <ContactShadows position={[0, 0.06, 0]} scale={90} blur={2.4} opacity={0.35} far={40} resolution={512} />
      {projectList.map((project, index) => (
        <ProjectStudio key={project.id} project={project} index={index} />
      ))}
    </Canvas>
  );
}
