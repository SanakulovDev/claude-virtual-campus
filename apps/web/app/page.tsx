'use client';

import dynamic from 'next/dynamic';
import { useCampusSocket } from '../hooks/useCampusSocket';
import { HeaderBar } from '../components/panels/HeaderBar';
import { InspectorPanel } from '../components/panels/InspectorPanel';
import { TimelinePanel } from '../components/panels/TimelinePanel';
import { ApprovalPanel } from '../components/panels/ApprovalPanel';
import { ProjectListPanel } from '../components/panels/ProjectListPanel';

const CampusScene = dynamic(() => import('../components/campus/CampusScene').then((m) => m.CampusScene), {
  ssr: false,
});

export default function Page() {
  useCampusSocket();

  return (
    <div className="flex h-screen flex-col">
      <HeaderBar />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <CampusScene />
          <ApprovalPanel />
        </div>
        <aside className="flex w-80 flex-none flex-col border-l border-slate-800 bg-slate-950">
          <div className="border-b border-slate-800">
            <div className="px-3 py-2 text-xs uppercase tracking-wide text-slate-400">Projects</div>
            <ProjectListPanel />
          </div>
          <div className="min-h-0 flex-1">
            <InspectorPanel />
          </div>
        </aside>
      </div>
      <div className="h-10 flex-none">
        <TimelinePanel />
      </div>
    </div>
  );
}
