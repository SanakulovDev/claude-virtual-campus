'use client';

import { useState, type ReactNode } from 'react';
import { profileForAgentType } from '@campus/contracts';
import { useCampusStore } from '../../stores/campusStore';
import { selectAgentVisualState } from '../../selectors/visual-state.selector';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { summarizeTimelineEntry } from '../../selectors/activity-summary.selector';
import { selectAgentActivityLine } from '../../selectors/activity-source.selector';
import { useAmbientActivity } from '../../hooks/useAmbientActivity';
import { STATE_COLOR, STATE_LABEL } from '../../lib/theme';
import { renameAgent, removeProject } from '../../lib/socket';
import type { AgentRow, ProjectRow, TimelineEntry } from '../../lib/types';

function agentRole(agent: AgentRow): string {
  return agent.role ?? profileForAgentType(agent.agentType).role;
}

function agentBio(agent: AgentRow): string {
  return agent.bio ?? profileForAgentType(agent.agentType).bio;
}

/** Inline rename control. Persists via the API; the socket echoes the update back. */
function RenameControl({ agent }: { agent: AgentRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(agent.displayName);
  const canReset = Boolean(agent.customName);

  if (!editing) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => {
            setValue(agent.displayName);
            setEditing(true);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
        >
          Rename
        </button>
        {canReset && (
          <button
            onClick={() => void renameAgent(agent.id, null)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-700"
          >
            Reset name
          </button>
        )}
      </div>
    );
  }

  const save = () => {
    const trimmed = value.trim();
    void renameAgent(agent.id, trimmed.length ? trimmed : null);
    setEditing(false);
  };

  return (
    <div className="flex gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-sky-500"
        aria-label="Agent name"
      />
      <button onClick={save} className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500">
        Save
      </button>
      <button onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
        Cancel
      </button>
    </div>
  );
}

/** Two-click "Remove from campus". The server cascades the room's data and broadcasts
 * project:removed, which closes this drawer. A live project reappears on its next event. */
function RemoveProjectControl({ project }: { project: ProjectRow }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-md border border-rose-200 bg-white py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
      >
        Remove from campus
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-slate-500">
        Removes this room and its history. It returns if the project sends new activity.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => void removeProject(project.id)}
          className="flex-1 rounded-md bg-rose-600 py-2 text-xs font-medium text-white hover:bg-rose-500"
        >
          Confirm remove
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-md border border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200/70 px-4 py-3">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function StatePill({ state }: { state: keyof typeof STATE_COLOR }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${STATE_COLOR[state]}22`, color: STATE_COLOR[state] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_COLOR[state] }} />
      {STATE_LABEL[state]}
    </span>
  );
}

function RecentActivity({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return <p className="text-xs text-slate-500">No recent activity.</p>;
  return (
    <ul className="space-y-1">
      {entries.slice(0, 8).map((e) => (
        <li key={e.id} className="text-xs text-slate-600">
          {summarizeTimelineEntry(e)}
        </li>
      ))}
    </ul>
  );
}

function DeveloperDetails({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const show = useCampusStore((s) => s.ui.developerDetails);
  const toggle = useCampusStore((s) => s.toggleDeveloperDetails);
  return (
    <Section title="Developer details">
      <button onClick={toggle} className="mb-1 text-xs text-slate-400 hover:text-slate-700">
        {show ? 'Hide' : 'Show'} raw fields
      </button>
      {show && (
        <dl className="space-y-1">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px]">
              <dt className="w-28 flex-none text-slate-500">{k}</dt>
              <dd className="min-w-0 break-all text-slate-600">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

function AgentInspector({ agent, project, timeline }: { agent: AgentRow; project: ProjectRow | null; timeline: TimelineEntry[] }) {
  const state = selectAgentVisualState(agent);
  const followAgent = useCampusStore((s) => s.followAgent);
  const stopFollowing = useCampusStore((s) => s.stopFollowingAgent);
  const camera = useCampusStore((s) => s.camera);
  const following = camera.mode === 'follow' && camera.followedAgentId === agent.id;
  const task = project?.tasks?.find((t) => t.id === agent.currentTaskId);
  const entries = timeline.filter((e) => e.agentId === agent.id);
  const ambient = useAmbientActivity(agent, project?.id ?? '');
  const line = selectAgentActivityLine(agent, ambient);
  const resting = useCampusStore((s) => Boolean(s.restingAgentIds[agent.id]));
  const toggleRest = useCampusStore((s) => s.toggleAgentRest);
  const canRest = state === 'idle' || resting; // resting a busy bot is meaningless

  return (
    <>
      <div className="px-4 py-3">
        <div className="text-base font-semibold text-slate-900">{agent.displayName}</div>
        <div className="text-xs text-slate-500">
          {agentRole(agent)}
          {project ? ` · ${project.name}` : ''}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <StatePill state={state} />
          <RenameControl agent={agent} />
        </div>
      </div>

      <Section title="Profile">
        <p className="text-xs leading-relaxed text-slate-600">{agentBio(agent)}</p>
      </Section>

      <Section title="Current work">
        <p className="text-sm text-slate-700">{line.text}</p>
        {line.sourceLabel && (
          <p className={`mt-1 text-[11px] ${line.source === 'ambient-idle' ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
            {line.sourceLabel}
          </p>
        )}
        {task && <p className="mt-1 text-xs text-slate-500">Task: {task.title}</p>}
      </Section>

      <Section title="Recent activity">
        <RecentActivity entries={entries} />
      </Section>

      <div className="flex gap-2 px-4 py-3">
        {following ? (
          <button onClick={stopFollowing} className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Stop following
          </button>
        ) : (
          <button onClick={() => followAgent(agent.id)} className="flex-1 rounded-md bg-sky-600 py-2 text-xs font-medium text-white hover:bg-sky-500">
            Follow agent
          </button>
        )}
        {canRest && (
          <button
            onClick={() => toggleRest(agent.id)}
            title="Cosmetic only: rests an idle bot. Real activity wakes it instantly."
            className={`flex-1 rounded-md border py-2 text-xs font-medium ${
              resting ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {resting ? 'Wake' : 'Rest'}
          </button>
        )}
      </div>

      <DeveloperDetails
        rows={[
          ['agent type', agent.agentType],
          ['generated name', agent.generatedName],
          ['agent id', agent.externalAgentId],
          ['session', agent.currentSessionId],
          ['zone', agent.currentZoneKey],
          ['activity', agent.activity],
          ['activity source', line.source],
          ['tool', agent.currentTool],
          ['file', agent.currentFile],
          ['command', agent.currentCommandSummary],
          ['category', agent.commandCategory],
        ]}
      />
    </>
  );
}

function ProjectInspector({ project, timeline }: { project: ProjectRow; timeline: TimelineEntry[] }) {
  const state = selectProjectVisualState(project.agents);
  const selectAgent = useCampusStore((s) => s.selectAgent);
  const approvals = useCampusStore((s) => s.approvals);
  const entries = timeline.filter((e) => e.projectId === project.id);
  const pending = Object.values(approvals).filter((a) => a.projectId === project.id && a.status === 'PENDING');

  return (
    <>
      <div className="px-4 py-3">
        <div className="text-base font-semibold text-slate-900">{project.name}</div>
        <div className="text-xs text-slate-500">{project.isGitRepository ? 'git repository' : 'local directory'}</div>
        <div className="mt-2">
          <StatePill state={state} />
        </div>
      </div>

      {project.technologies.length > 0 && (
        <Section title="Technology">
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map((t) => (
              <span key={t.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {t.displayName}
              </span>
            ))}
          </div>
        </Section>
      )}

      {project.modules.length > 0 && (
        <Section title="Modules">
          {project.modules.map((m) => (
            <div key={m.id} className="text-xs text-slate-400">
              {m.relativePath} <span className="text-slate-400">({m.primaryLanguage ?? 'unknown'})</span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Agents">
        <div className="space-y-1">
          {project.agents.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-slate-100"
            >
              <span className="flex flex-col">
                <span className="text-xs text-slate-700">{a.displayName}</span>
                <span className="text-[10px] text-slate-500">{agentRole(a)}</span>
              </span>
              <StatePill state={selectAgentVisualState(a)} />
            </button>
          ))}
        </div>
      </Section>

      {pending.length > 0 && (
        <Section title="Pending approvals">
          {pending.map((a) => (
            <p key={a.id} className="text-xs text-rose-300">{a.safeSummary}</p>
          ))}
        </Section>
      )}

      <Section title="Recent activity">
        <RecentActivity entries={entries} />
      </Section>

      <div className="px-4 py-3">
        <RemoveProjectControl project={project} />
      </div>

      <DeveloperDetails
        rows={[
          ['project key', project.projectKey],
          ['root path', project.rootPath],
          ['remote', project.remoteUrl],
          ['room', project.roomTemplate],
        ]}
      />
    </>
  );
}

/** Right-hand drawer. Collapsed by default; opens on selection; closable. */
export function InspectorDrawer() {
  const open = useCampusStore((s) => s.ui.inspectorOpen);
  const selection = useCampusStore((s) => s.selection);
  const projects = useCampusStore((s) => s.projects);
  const timeline = useCampusStore((s) => s.timeline);
  const close = useCampusStore((s) => s.closeInspector);

  const project = selection.selectedProjectId ? projects[selection.selectedProjectId] ?? null : null;
  const agent = project?.agents.find((a) => a.id === selection.selectedAgentId) ?? null;

  if (!open || (!project && !agent)) return null;

  return (
    <aside
      className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-[340px] max-w-[88vw] flex-col overflow-y-auto border-l border-slate-200/80 panel-solid"
      role="complementary"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inspector</span>
        <button onClick={close} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Close inspector">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {agent ? <AgentInspector agent={agent} project={project} timeline={timeline} /> : project ? <ProjectInspector project={project} timeline={timeline} /> : null}
    </aside>
  );
}
