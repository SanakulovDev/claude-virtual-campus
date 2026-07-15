'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { UnsignedByteType } from 'three';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusHub } from './CampusHub';
import { CampusCameraController } from './CampusCameraController';
import { ProjectStudio } from './ProjectStudio';
import { useCampusStore } from '../../stores/campusStore';
import { detectRenderCapability } from '../../lib/renderCapability';

class EffectsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function OptionalEffects() {
  const renderer = useThree((state) => state.gl);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const canvas = renderer.domElement;
    const disable = () => setEnabled(false);
    setEnabled(detectRenderCapability(renderer.getContext()) === 'full');
    canvas.addEventListener('webglcontextlost', disable);
    return () => canvas.removeEventListener('webglcontextlost', disable);
  }, [renderer]);

  if (!enabled) return null;

  return (
    <>
      <ContactShadows
        position={[0, 0.06, 0]}
        scale={90}
        blur={2.4}
        opacity={0.35}
        far={40}
        resolution={512}
      />
      <EffectComposer multisampling={0} frameBufferType={UnsignedByteType}>
        <Bloom intensity={0.6} luminanceThreshold={0.7} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);
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
      {projectList.map((project, index) => (
        <ProjectStudio key={project.id} project={project} index={index} />
      ))}
      <EffectsBoundary>
        <OptionalEffects />
      </EffectsBoundary>
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
