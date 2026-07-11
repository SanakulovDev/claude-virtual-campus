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
import { renameAgent } from '../../lib/socket';
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

      <div className="px-4 py-3">
        {following ? (
          <button onClick={stopFollowing} className="w-full rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Stop following
          </button>
        ) : (
          <button onClick={() => followAgent(agent.id)} className="w-full rounded-md bg-sky-600 py-2 text-xs font-medium text-white hover:bg-sky-500">
            Follow agent
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
