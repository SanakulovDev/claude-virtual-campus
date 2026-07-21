'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState } from '../../selectors/visual-state.selector';
import { STATE_COLOR } from '../../lib/theme';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="truncate text-[11px] text-slate-400">{label}</span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-200">{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Compact, honest fleet telemetry. Utilization = share of agents doing real work.
 * "Activity" per project = share of that project's agents currently active. No fake progress. */
export function AnalyticsPanel() {
  const projects = useCampusStore((s) => s.projects);
  const inspectorOpen = useCampusStore((s) => s.ui.inspectorOpen);

  const list = Object.values(projects);
  const allAgents = list.flatMap((p) => p.agents);
  const activeAgents = allAgents.filter((a) => selectAgentVisualState(a) !== 'idle').length;
  const utilization = allAgents.length ? activeAgents / allAgents.length : 0;

  if (inspectorOpen || list.length === 0) return null;

  const perProject = list
    .map((p) => {
      const active = p.agents.filter((a) => selectAgentVisualState(a) !== 'idle').length;
      // Keyed by id, not name: two projects can share a directory basename.
      return { id: p.id, name: p.name, ratio: p.agents.length ? active / p.agents.length : 0, state: selectProjectVisualState(p.agents) };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4);

  return (
    <div className="panel-solid pointer-events-auto absolute bottom-4 right-4 z-10 w-64 rounded-lg border border-white/10 p-3.5 shadow-xl">
      <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Fleet telemetry</div>
      <Bar label="Utilization" value={utilization} color="#3ecf8e" />
      <div className="mt-3 space-y-2">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Project activity</div>
        {perProject.map((p) => (
          <Bar key={p.id} label={p.name} value={p.ratio} color={STATE_COLOR[p.state]} />
        ))}
      </div>
    </div>
  );
}
