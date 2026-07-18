'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusCameraController } from './CampusCameraController';
import { OfficeBuilding } from '../office/OfficeBuilding';
import { OfficeRoom } from '../office/OfficeRoom';
import { OfficeAgent } from '../office/OfficeAgent';
import { useCampusStore } from '../../stores/campusStore';
import { useKioskMode } from '../../hooks/useKioskMode';
import { assignDesks } from '../../selectors/desk-assignment';
import { buildingBounds } from '../../selectors/office-layout';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProject = useCampusStore((s) => s.focusProjectRoom);
  const kiosk = useKioskMode();

  const bounds = buildingBounds(projectList.length);
  const anyChecking = projectList.some((p) => selectProjectVisualState(p.agents) === 'checking');

  // crowd counts for the shared review area span ALL projects now
  const reviewCrowd = projectList.flatMap((p) =>
    assignDesks(p.agents)
      .filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'review-screen')
      .map((a) => ({ agentId: a.agent.id })),
  );

  return (
    <Canvas
      shadows
      dpr={kiosk ? [1, 1.25] : [1, 1.8]}
      orthographic
      camera={{ position: [60, 60, 60], zoom: 20, near: -200, far: 600 }}
      onPointerMissed={() => deselect()}
      gl={{ antialias: true }}
    >
      <CampusEnvironment />
      <CampusCameraController />
      <ContactShadows
        position={[(bounds.minX + bounds.maxX) / 2, 0.03, 0]}
        scale={Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.2}
        blur={2.4}
        opacity={0.3}
        far={30}
        resolution={1024}
      />
      <OfficeBuilding projectCount={projectList.length} anyChecking={anyChecking} />

      {projectList.map((project, index) => {
        const active = selectProjectVisualState(project.agents) !== 'idle';
        return (
          <OfficeRoom
            key={project.id}
            project={project}
            index={index}
            detail={active || index < 8 ? 'full' : 'reduced'}
            onSelect={() => { selectProject(project.id); focusProject(project.id); }}
          />
        );
      })}

      {projectList.map((project, index) => {
        const assigned = assignDesks(project.agents);
        const planning = assigned.filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'planning-table');
        return assigned.map(({ agent, deskIndex }) => {
          const loc = selectStudioLocation(selectAgentVisualState(agent));
          const crowdList = loc === 'planning-table'
            ? planning.map((a) => ({ agentId: a.agent.id }))
            : loc === 'review-screen' ? reviewCrowd : [];
          const crowdIndex = crowdList.findIndex((c) => c.agentId === agent.id);
          return (
            <OfficeAgent
              key={agent.id}
              agent={agent}
              projectId={project.id}
              projectIndex={index}
              deskIndex={deskIndex}
              crowd={{ index: crowdIndex < 0 ? 0 : crowdIndex, count: crowdList.length || 1 }}
              projectCount={projectList.length}
            />
          );
        });
      })}
    </Canvas>
  );
}
