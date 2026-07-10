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

/** Narrow, collapsible dock of projects. State dot + name + agent count + short state +
 * attention badge. No repository paths or heavy metadata. */
export function ProjectDock() {
  const projects = useCampusStore((s) => s.projects);
  const approvals = useCampusStore((s) => s.approvals);
  const selection = useCampusStore((s) => s.selection);
  const collapsed = useCampusStore((s) => s.ui.dockCollapsed);
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProject = useCampusStore((s) => s.focusProjectRoom);

  const pendingByProject = new Set(
    Object.values(approvals).filter((a) => a.status === 'PENDING').map((a) => a.projectId),
  );

  const list = Object.values(projects)
    .map((p) => ({ project: p, state: selectProjectVisualState(p.agents) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.project.name.localeCompare(b.project.name));

  if (collapsed) return null;

  return (
    <aside className="flex w-60 flex-none flex-col border-r border-slate-800/80 bg-slate-950/85 backdrop-blur">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projects</div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && (
          <p className="px-3 py-4 text-xs leading-relaxed text-slate-500">
            No projects yet. Run a Claude Code session with the hook installed, or <code>pnpm demo:events</code>.
          </p>
        )}
        {list.map(({ project, state }) => {
          const selected = selection.selectedProjectId === project.id;
          const hasAttention = state === 'attention' || pendingByProject.has(project.id);
          return (
            <button
              key={project.id}
              onClick={() => {
                selectProject(project.id);
                focusProject(project.id);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                selected ? 'bg-slate-800/80' : 'hover:bg-slate-900'
              }`}
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: STATE_COLOR[state], boxShadow: `0 0 0 3px ${projectAccent(project.projectKey)}22` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-100">{project.name}</span>
                <span className="text-[11px] text-slate-500">
                  {project.agents.length} agent{project.agents.length === 1 ? '' : 's'} · {STATE_LABEL[state]}
                </span>
              </span>
              {hasAttention && (
                <span className="flex-none rounded-full bg-rose-500/20 px-1.5 text-xs font-bold text-rose-300">
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
