'use client';

import { useCampusStore } from '../../stores/campusStore';

export function InspectorPanel() {
  const selection = useCampusStore((s) => s.selection);
  const projects = useCampusStore((s) => s.projects);
  const followAgent = useCampusStore((s) => s.followAgent);
  const stopFollowingAgent = useCampusStore((s) => s.stopFollowingAgent);
  const camera = useCampusStore((s) => s.camera);

  const project = selection.selectedProjectId ? projects[selection.selectedProjectId] : null;
  const agent = project?.agents.find((a) => a.id === selection.selectedAgentId) ?? null;

  if (!project) {
    return <div className="p-3 text-sm text-slate-400">Select a project room to inspect it.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <section>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Project</h3>
        <div className="font-medium">{project.name}</div>
        <div className="break-all text-xs text-slate-500">{project.rootPath}</div>
        <div className="text-xs text-slate-500">{project.remoteUrl ?? 'no remote'}</div>
        <div className="text-xs text-slate-500">{project.isGitRepository ? 'git repository' : 'not a git repository'}</div>
      </section>

      <section>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Detected technologies</h3>
        {project.technologies.length === 0 && <div className="text-xs text-slate-500">None detected yet</div>}
        <div className="flex flex-wrap gap-1">
          {project.technologies.map((t) => (
            <span key={t.id} className="rounded bg-slate-800 px-2 py-0.5 text-xs">
              {t.displayName}
            </span>
          ))}
        </div>
      </section>

      {project.modules.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Modules</h3>
          {project.modules.map((m) => (
            <div key={m.id} className="text-xs text-slate-400">
              {m.relativePath} ({m.primaryLanguage ?? 'unknown'})
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Agents</h3>
        {project.agents.map((a) => (
          <div key={a.id} className="mb-1 rounded border border-slate-800 p-1.5 text-xs">
            <div className="font-medium">{a.displayName}</div>
            <div className="text-slate-400">{a.agentType} · {a.activity} · {a.currentZoneKey}</div>
          </div>
        ))}
      </section>

      {agent && (
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Selected agent</h3>
          <div className="text-xs text-slate-300">Current tool: {agent.currentTool ?? '—'}</div>
          <div className="text-xs text-slate-300">Current file: {agent.currentFile ?? '—'}</div>
          <div className="text-xs text-slate-300">Command: {agent.currentCommandSummary ?? '—'} ({agent.commandCategory ?? '—'})</div>
          {camera.mode === 'follow' && camera.followedAgentId === agent.id ? (
            <button onClick={stopFollowingAgent} className="mt-1 rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
              Stop following
            </button>
          ) : (
            <button onClick={() => followAgent(agent.id)} className="mt-1 rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
              Follow agent
            </button>
          )}
        </section>
      )}
    </div>
  );
}
