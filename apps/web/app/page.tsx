'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useCampusSocket } from '../hooks/useCampusSocket';
import { CampusTopBar } from '../components/ui/CampusTopBar';
import { ProjectDock } from '../components/ui/ProjectDock';
import { InspectorDrawer } from '../components/ui/InspectorDrawer';
import { ContextTimeline } from '../components/ui/ContextTimeline';
import { ApprovalDrawer } from '../components/ui/ApprovalDrawer';
import { useCampusStore } from '../stores/campusStore';

const CampusScene = dynamic(() => import('../components/campus/CampusScene').then((m) => m.CampusScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading campus…</div>,
});

export default function Page() {
  useCampusSocket();
  const closeInspector = useCampusStore((s) => s.closeInspector);
  const stopFollowing = useCampusStore((s) => s.stopFollowingAgent);
  const cameraMode = useCampusStore((s) => s.camera.mode);

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
    <div className="flex h-screen flex-col bg-slate-950">
      <CampusTopBar />
      <div className="flex min-h-0 flex-1">
        <ProjectDock />
        <main className="relative min-w-0 flex-1" data-testid="campus-canvas">
          <CampusScene />
          <InspectorDrawer />
          <ApprovalDrawer />
        </main>
      </div>
      <ContextTimeline />
    </div>
  );
}
