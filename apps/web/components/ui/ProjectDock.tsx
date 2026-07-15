'use client';

import { useCampusStore } from '../../stores/campusStore';
import { selectProjectVisualState, type ProjectVisualState } from '../../selectors/project-status.selector';
import { STATE_COLOR, STATE_ICON, STATE_LABEL, projectAccent } from '../../lib/theme';

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
    <aside className="panel flex w-64 flex-none flex-col border-r border-slate-200/80">
      <div className="px-4 pb-1.5 pt-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">My Projects</div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {list.length === 0 && (
          <p className="px-4 py-4 text-xs leading-relaxed text-slate-400">
            {query ? 'No matching projects.' : (
              <>No projects yet. Run a Claude Code or Codex session with campus hooks installed, or <code className="rounded bg-slate-100 px-1">pnpm demo:events</code>.</>
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
              className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                selected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-white/60'
              }`}
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: STATE_COLOR[state], boxShadow: `0 0 0 3px ${projectAccent(project.projectKey)}22` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-800">{project.name}</span>
                <span className="text-[11px] text-slate-500">
                  {n} Agent{n === 1 ? '' : 's'}, {STATE_LABEL[state]}
                </span>
              </span>
              {hasAttention && (
                <span className="flex-none rounded-full bg-rose-100 px-1.5 text-xs font-bold text-rose-600">
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
