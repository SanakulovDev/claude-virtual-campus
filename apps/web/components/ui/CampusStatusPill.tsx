'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState } from '../../selectors/project-status.selector';

/** Bottom-centre campus summary. "Optimal" unless something needs a human (pending approval
 * or an agent in attention state) — honest, derived from real state, never decorative. */
export function CampusStatusPill() {
  const projects = useCampusStore((s) => s.projects);
  const approvals = useCampusStore((s) => s.approvals);

  const list = Object.values(projects);
  if (list.length === 0) return null;

  const activeProjects = list.filter((p) => selectProjectVisualState(p.agents) !== 'idle').length;
  const totalAgents = list.reduce((sum, p) => sum + p.agents.length, 0);
  const pending = Object.values(approvals).filter((a) => a.status === 'PENDING').length;
  const needsAttention = pending > 0 || list.some((p) => selectProjectVisualState(p.agents) === 'attention');

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="panel-solid flex items-center gap-3 rounded-full border border-slate-200/80 px-4 py-1.5 text-[12px] shadow-md">
        <span className="text-slate-500">
          Active Projects <span className="font-semibold text-slate-800 tabular-nums">{activeProjects}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">
          Campus Agents <span className="font-semibold text-slate-800 tabular-nums">{totalAgents}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5 font-medium" style={{ color: needsAttention ? '#c98a1e' : '#12a150' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: needsAttention ? '#c98a1e' : '#12a150' }} />
          {needsAttention ? 'Needs Attention' : 'Optimal'}
        </span>
      </div>
    </div>
  );
}
