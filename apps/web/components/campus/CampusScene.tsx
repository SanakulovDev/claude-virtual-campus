'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusHub } from './CampusHub';
import { CampusCameraController } from './CampusCameraController';
import { ProjectStudio } from './ProjectStudio';
import { useCampusStore } from '../../stores/campusStore';
import { calculateIslandRadius } from '../../selectors/campus-layout';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);
  const islandRadius = calculateIslandRadius(projectList.length);

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
      {/* Above the grass (y 0.08), not below it: an opaque lawn 0.02 higher hid these
          entirely, which is what left everything looking like it floated. */}
      <ContactShadows
        position={[0, 0.09, 0]}
        scale={islandRadius * 2}
        blur={2.4}
        opacity={0.35}
        far={40}
        resolution={1024}
      />
      {projectList.map((project, index) => (
        <ProjectStudio key={project.id} project={project} index={index} />
      ))}
    </Canvas>
  );
}
