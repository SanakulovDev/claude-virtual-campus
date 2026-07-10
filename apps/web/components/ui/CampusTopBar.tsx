'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState } from '../../selectors/project-status.selector';

const CONNECTION_COLOR = { connected: '#4bb07a', connecting: '#d6b03c', disconnected: '#d6604f' } as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold text-slate-100 tabular-nums">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

/** Compact top bar: name, connection, live counts, overview. No filters/forms/debug. */
export function CampusTopBar() {
  const connectionStatus = useCampusStore((s) => s.connectionStatus);
  const projects = useCampusStore((s) => s.projects);
  const approvals = useCampusStore((s) => s.approvals);
  const returnToCampus = useCampusStore((s) => s.returnToCampus);
  const toggleDock = useCampusStore((s) => s.toggleDock);
  const ambientLifeEnabled = useCampusStore((s) => s.ui.ambientLifeEnabled);
  const toggleAmbientLife = useCampusStore((s) => s.toggleAmbientLife);

  const list = Object.values(projects);
  const totalProjects = list.length;
  const totalAgents = list.reduce((sum, p) => sum + p.agents.length, 0);
  const activeAgents = list.flatMap((p) => p.agents).filter((a) => selectProjectVisualState([a]) !== 'idle').length;
  const pending = Object.values(approvals).filter((a) => a.status === 'PENDING').length;

  return (
    <header className="flex h-12 flex-none items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDock}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Toggle project dock"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 3.5h12M2 8h12M2 12.5h12" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold tracking-tight text-slate-100">Claude Virtual Campus</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: CONNECTION_COLOR[connectionStatus] }} />
          {connectionStatus}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <Stat label="projects" value={totalProjects} />
        <Stat label={activeAgents > 0 ? 'active' : 'agents'} value={activeAgents > 0 ? activeAgents : totalAgents} />
        {pending > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1">
            <span className="text-sm font-semibold text-rose-300 tabular-nums">{pending}</span>
            <span className="text-[11px] uppercase tracking-wide text-rose-300/80">pending</span>
          </div>
        )}
        <button
          onClick={toggleAmbientLife}
          aria-pressed={ambientLifeEnabled}
          title="Ambient idle life is cosmetic only and never counts as real Claude work"
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
            ambientLifeEnabled
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          Ambient life: {ambientLifeEnabled ? 'on' : 'off'}
        </button>
        <button
          onClick={returnToCampus}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Campus overview
        </button>
      </div>
    </header>
  );
}
