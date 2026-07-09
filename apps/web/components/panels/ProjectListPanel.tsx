'use client';

import { useCampusStore } from '../../stores/campusStore';

/** Plain 2D list of projects/agents, for when the 3D canvas isn't the right view. */
export function ProjectListPanel() {
  const projects = useCampusStore((s) => s.projects);
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProjectRoom = useCampusStore((s) => s.focusProjectRoom);
  const projectList = Object.values(projects);

  if (projectList.length === 0) {
    return <div className="p-3 text-xs text-slate-500">No projects yet. Run a Claude Code session with the hook installed, or `pnpm demo:events`.</div>;
  }

  return (
    <ul className="divide-y divide-slate-800 overflow-y-auto text-sm">
      {projectList.map((project) => (
        <li
          key={project.id}
          className="cursor-pointer px-3 py-2 hover:bg-slate-900"
          onClick={() => {
            selectProject(project.id);
            focusProjectRoom(project.id);
          }}
        >
          <div className="font-medium">{project.name}</div>
          <div className="text-xs text-slate-500">
            {project.technologies.slice(0, 3).map((t) => t.displayName).join(', ') || 'unknown technology'} · {project.agents.length} agents
          </div>
        </li>
      ))}
    </ul>
  );
}
