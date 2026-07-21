'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState, type ProjectVisualState } from '../../selectors/project-status.selector';
import { STATE_COLOR, STATE_ICON, STATE_LABEL } from '../../lib/theme';

const STATE_ORDER: Record<ProjectVisualState, number> = {
  attention: 0,
  checking: 1,
  working: 2,
  planning: 3,
  completed: 4,
  idle: 5,
};

/** Narrow project rail. State dot + name + agent count + short state + attention badge.
 * Filters live on the top-bar search. No repository paths or heavy metadata. */
export function ProjectDock() {
  const projects = useCampusStore((s) => s.projects);
  const approvals = useCampusStore((s) => s.approvals);
  const selection = useCampusStore((s) => s.selection);
  const collapsed = useCampusStore((s) => s.ui.dockCollapsed);
  const query = useCampusStore((s) => s.ui.searchQuery).trim().toLowerCase();
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProject = useCampusStore((s) => s.focusProjectRoom);

  const pendingByProject = new Set(
    Object.values(approvals).filter((a) => a.status === 'PENDING').map((a) => a.projectId),
  );

  const list = Object.values(projects)
    .filter((p) =>
      query === '' ||
      p.name.toLowerCase().includes(query) ||
      p.agents.some((a) => a.displayName.toLowerCase().includes(query)),
    )
    .map((p) => ({ project: p, state: selectProjectVisualState(p.agents) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.project.name.localeCompare(b.project.name));

  if (collapsed) return null;

  return (
    <aside className="panel flex w-64 flex-none flex-col border-r border-white/10">
      <div className="px-4 pb-1.5 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Projects</div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {list.length === 0 && (
          <p className="px-4 py-4 text-xs leading-relaxed text-slate-500">
            {query ? 'No matching projects.' : (
              <>No projects yet. Run a Claude Code session with the hook installed, or <code className="rounded bg-white/10 px-1 font-mono">pnpm demo:events</code>.</>
            )}
          </p>
        )}
        {list.map(({ project, state }) => {
          const selected = selection.selectedProjectId === project.id;
          const hasAttention = state === 'attention' || pendingByProject.has(project.id);
          const n = project.agents.length;
          return (
            <button
              key={project.id}
              onClick={() => {
                selectProject(project.id);
                focusProject(project.id);
              }}
              className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                selected ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: STATE_COLOR[state] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12px] font-medium text-slate-200">{project.name}</span>
                <span className="text-[11px] text-slate-500">
                  {n} agent{n === 1 ? '' : 's'} · {STATE_LABEL[state]}
                </span>
              </span>
              {hasAttention && (
                <span className="flex-none rounded bg-rose-500/15 px-1.5 font-mono text-xs font-bold text-rose-400">
                  {STATE_ICON.attention}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
