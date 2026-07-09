'use client';

import { useCampusStore } from '../../stores/campusStore';

export function HeaderBar() {
  const connectionStatus = useCampusStore((s) => s.connectionStatus);
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const activeAgents = projectList.flatMap((p) => p.agents).filter((a) => a.status === 'active').length;
  const returnToCampus = useCampusStore((s) => s.returnToCampus);

  const statusColor = connectionStatus === 'connected' ? '#22c55e' : connectionStatus === 'connecting' ? '#facc15' : '#ef4444';

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold">Claude Virtual Campus</span>
        <button onClick={returnToCampus} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
          Return to campus
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-300">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
          {connectionStatus}
        </span>
        <span>{projectList.length} projects</span>
        <span>{activeAgents} active agents</span>
      </div>
    </header>
  );
}
