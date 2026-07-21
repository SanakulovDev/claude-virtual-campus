'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState } from '../../selectors/project-status.selector';

/** Bottom-centre campus summary. "Nominal" unless something needs a human (pending approval
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
      <div className="panel-solid flex items-center gap-3 rounded-md border border-white/10 px-4 py-1.5 font-mono text-[11px] shadow-lg">
        <span className="text-slate-400">
          Projects <span className="font-semibold text-slate-100 tabular-nums">{activeProjects}</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">
          Agents <span className="font-semibold text-slate-100 tabular-nums">{totalAgents}</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider" style={{ color: needsAttention ? '#f2b23c' : '#3ecf8e' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: needsAttention ? '#f2b23c' : '#3ecf8e' }} />
          {needsAttention ? 'Needs attention' : 'Nominal'}
        </span>
      </div>
    </div>
  );
}
