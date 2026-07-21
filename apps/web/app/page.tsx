'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useCampusSocket } from '../hooks/useCampusSocket';
import { useKioskMode } from '../hooks/useKioskMode';
import { useKioskDirector } from '../hooks/useKioskDirector';
import { CampusTopBar } from '../components/ui/CampusTopBar';
import { ProjectDock } from '../components/ui/ProjectDock';
import { InspectorDrawer } from '../components/ui/InspectorDrawer';
import { ContextTimeline } from '../components/ui/ContextTimeline';
import { ApprovalDrawer } from '../components/ui/ApprovalDrawer';
import { AnalyticsPanel } from '../components/ui/AnalyticsPanel';
import { CampusStatusPill } from '../components/ui/CampusStatusPill';
import { useCampusStore } from '../stores/campusStore';
import { selectAgentVisualState } from '../selectors/visual-state.selector';

const CampusScene = dynamic(() => import('../components/campus/CampusScene').then((m) => m.CampusScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center font-mono text-sm text-slate-500">Loading lab…</div>,
});

export default function Page() {
  useCampusSocket();
  const kiosk = useKioskMode();
  useKioskDirector();
  const closeInspector = useCampusStore((s) => s.closeInspector);
  const stopFollowing = useCampusStore((s) => s.stopFollowingAgent);
  const cameraMode = useCampusStore((s) => s.camera.mode);
  const anyAttention = useCampusStore((s) =>
    Object.values(s.projects).some((p) => p.agents.some((a) => selectAgentVisualState(a) === 'attention')),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (cameraMode === 'follow') stopFollowing();
      closeInspector();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cameraMode, closeInspector, stopFollowing]);

  return (
    <div className="flex h-screen flex-col bg-ink">
      {!kiosk && <CampusTopBar />}
      <div className="flex min-h-0 flex-1">
        {!kiosk && <ProjectDock />}
        <main className="relative min-w-0 flex-1" data-testid="campus-canvas">
          <CampusScene />
          {!kiosk && (
            <>
              <AnalyticsPanel />
              <CampusStatusPill />
              <InspectorDrawer />
              <ApprovalDrawer />
            </>
          )}
        </main>
      </div>
      {!kiosk && <ContextTimeline />}
      {kiosk && anyAttention && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 animate-pulse border-8 border-red-500/80" />
      )}
    </div>
  );
}
