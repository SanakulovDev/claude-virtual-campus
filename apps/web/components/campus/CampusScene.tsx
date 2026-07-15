'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusHub } from './CampusHub';
import { CampusCameraController } from './CampusCameraController';
import { ProjectStudio } from './ProjectStudio';
import { useCampusStore } from '../../stores/campusStore';
import { detectRenderCapability } from '../../lib/renderCapability';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);
  // Probed once per mount (not per render): headless/software-WebGL pipeline stays bloom-free.
  // Also gates ContactShadows -- its per-frame render-to-texture washes the whole ortho view
  // black on software WebGL (SwiftShader), which blanked the screenshot pipeline.
  const fullFx = useMemo(() => detectRenderCapability() === 'full', []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      orthographic
      camera={{ position: [42, 46, 52], zoom: 34, near: 0.1, far: 600 }}
      onPointerMissed={() => deselect()}
      gl={{ antialias: true }}
    >
      <CampusEnvironment />
      <CampusCameraController />
      <CampusHub />
      {fullFx && (
        <ContactShadows position={[0, 0.06, 0]} scale={90} blur={2.4} opacity={0.35} far={40} resolution={512} />
      )}
      {projectList.map((project, index) => (
        <ProjectStudio key={project.id} project={project} index={index} />
      ))}
      {/* gated to real GPUs only -- keeps headless/software-WebGL screenshots clean */}
      {fullFx && (
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.7} mipmapBlur />
        </EffectComposer>
      )}
      {/* left button stays free for agent/room selection; orbit is right-drag, pan is middle-drag */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 3}
        minDistance={6}
        maxDistance={400}
        minZoom={16}
        maxZoom={90}
        mouseButtons={{ LEFT: undefined, MIDDLE: 2, RIGHT: 0 }}
      />
    </Canvas>
  );
}
